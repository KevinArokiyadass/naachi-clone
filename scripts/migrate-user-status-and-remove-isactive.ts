/**
 * Migration script to update user statuses and remove isActive field
 * 
 * This script:
 * 1. Fetches all users from the database
 * 2. For each user:
 *    - Normalizes their status using mapToUserStatus (migrates old statuses like 'completed', 'approved', 'legitimate' to 'active')
 *    - Removes the isActive field from the document
 * 3. Processes users in batches for better performance
 * 
 * Status Migration Rules:
 * - 'completed' -> 'active'
 * - 'approved' -> 'active'
 * - 'legitimate' -> 'active'
 * - 'pending' -> 'pending'
 * - 'blocked' -> 'blocked'
 * - 'active' -> 'active'
 * - any unknown status -> 'pending' (safe default)
 * 
 * Usage:
 *   npx ts-node scripts/migrate-user-status-and-remove-isactive.ts
 * 
 * Requirements:
 *   - Environment variables must be set (.env file)
 *   - MongoDB connection must be available
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { IMongoDBServices } from '../src/common/repository/mongodb-repository/abstract.repository';
import { mapToUserStatus, USER_STATUS } from '../src/common/enums/user.enum';

async function main() {
  console.log('🚀 Starting user status migration and isActive removal script...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dbService = app.get<IMongoDBServices>(IMongoDBServices);

  try {
    // Fetch all users (excluding deleted ones)
    console.log('📋 Fetching all users...');
    const users = await dbService.users.find({
      isDeleted: false
    });

    console.log(`✅ Found ${users.length} users to process\n`);

    if (users.length === 0) {
      console.log('⚠️  No users found. Exiting...');
      await app.close();
      return;
    }

    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const batchSize = 100;
    const statusChanges: Record<string, { from: string; to: string; count: number }> = {};

    // Process users in batches
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(users.length / batchSize);

      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} users)...`);

      const batchPromises = batch.map(async (user: any) => {
        try {
          const currentStatus = user.status || 'pending';
          const normalizedStatus = mapToUserStatus(currentStatus);
          
          // Track status changes
          if (currentStatus !== normalizedStatus) {
            const key = `${currentStatus} -> ${normalizedStatus}`;
            if (!statusChanges[key]) {
              statusChanges[key] = { from: currentStatus, to: normalizedStatus, count: 0 };
            }
            statusChanges[key].count++;
          }

          // Only update if status changed or isActive exists
          const needsUpdate = 
            currentStatus !== normalizedStatus || 
            user.isActive !== undefined;

          if (needsUpdate) {
            // Prepare update: normalize status and remove isActive
            const updateData: Record<string, any> = {};
            
            // Set normalized status if it changed
            if (currentStatus !== normalizedStatus) {
              updateData.$set = { status: normalizedStatus };
            }
            
            // Remove isActive if it exists
            if (user.isActive !== undefined) {
              updateData.$unset = { isActive: '' };
            }

            await dbService.users.findOneAndUpdate(
              { userId: { $eq: user.userId } },
              updateData
            );
            updatedCount++;
          } else {
            skippedCount++;
          }
        } catch (error) {
          console.error(`❌ Failed to update user ${user.userId}:`, error.message);
          failedCount++;
        }
      });

      await Promise.all(batchPromises);
      console.log(`✅ Batch ${batchNumber}/${totalBatches} completed\n`);
    }

    // As a final safety step, explicitly remove isActive from all users
    console.log('\n🧹 Running final cleanup to unset isActive on all users...');
    const unsetResult = await dbService.users.updateMany(
      {},
      { $unset: { isActive: '' } }
    );
    console.log(
      `🧾 isActive unset result -> matched: ${unsetResult.matchedCount}, modified: ${unsetResult.modifiedCount}`
    );

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));
    console.log(`✅ Successfully updated: ${updatedCount} users`);
    console.log(`⏭️  Skipped (no changes needed): ${skippedCount} users`);
    console.log(`❌ Failed: ${failedCount} users`);
    console.log(`📈 Total processed: ${users.length} users\n`);

    if (Object.keys(statusChanges).length > 0) {
      console.log('📋 Status Changes:');
      console.log('-'.repeat(60));
      for (const [key, change] of Object.entries(statusChanges)) {
        console.log(`  ${change.from} → ${change.to}: ${change.count} users`);
      }
      console.log('-'.repeat(60) + '\n');
    }

    console.log('✨ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await app.close();
    console.log('🔒 Database connection closed');
  }
}

// Run the migration
main()
  .then(() => {
    console.log('🎉 Script execution completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script execution failed:', error);
    process.exit(1);
  });
