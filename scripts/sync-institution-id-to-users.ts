/**
 * Migration script to sync institutionId from admin users to regular users
 * 
 * This script:
 * 1. Fetches all users with email addresses
 * 2. For each user, checks if there's an admin user with the same email
 * 3. If admin user exists and has institutionId in metaTags:
 *    - Validates phone numbers match (logs warning if they don't)
 *    - Syncs institutionId from admin's metaTags[0].institutionsId to user's institutionsId field
 *    - Marks user as isVerified: true only if phone numbers match
 * 
 * Usage:
 *   npx ts-node scripts/sync-institution-id-to-users.ts
 * 
 * Requirements:
 *   - Environment variables must be set (.env file)
 *   - MongoDB connection must be available
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { IMongoDBServices } from '../src/common/repository/mongodb-repository/abstract.repository';
import { IUsers } from '../src/common/interfaces/users.interface';
import { IAdminUser } from '../src/common/interfaces/admin-user.interface';

async function main() {
  console.log('🚀 Starting institutionId sync migration script...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dbService = app.get<IMongoDBServices>(IMongoDBServices);

  try {
    // Fetch all users with email addresses (excluding deleted ones)
    console.log('📋 Fetching all users with email addresses...');
    const users = await dbService.users.find(
      {
        $and: [
          { email: { $exists: true } },
          { email: { $ne: null } },
          { email: { $ne: '' } }
        ],
        isDeleted: false
      }
    );

    console.log(`✅ Found ${users.length} users with email addresses\n`);

    if (users.length === 0) {
      console.log('⚠️  No users with email addresses found. Exiting...');
      await app.close();
      return;
    }

    let syncedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let phoneMismatchCount = 0;
    const syncedUsers: Array<{
      userId: string;
      email: string;
      institutionId: string;
      phoneMatch: boolean;
    }> = [];

    // Process each user
    for (const user of users) {
      try {
        if (!user.email) {
          skippedCount++;
          continue;
        }

        // Find admin user with matching email
        const adminUser = await dbService.adminUser.findOne({
          email: user.email.toLowerCase().trim(),
          isDeleted: { $ne: true }
        });

        if (!adminUser) {
          skippedCount++;
          continue;
        }

        // Check if admin user has institutionId in metaTags
        const institutionId = adminUser.metaTags?.[0]?.institutionsId;
        if (!institutionId) {
          skippedCount++;
          console.log(`⏭️  Skipping user ${user.userId} (${user.email}): Admin user has no institutionId`);
          continue;
        }

        // Validate phone numbers match
        const phoneMatch = !user.phoneNumber || !adminUser.phoneNumber ||
          user.phoneNumber.trim() === adminUser.phoneNumber.trim();

        if (!phoneMatch) {
          phoneMismatchCount++;
          console.warn(
            `⚠️  Phone number mismatch for user ${user.userId} (${user.email}): ` +
            `User: ${user.phoneNumber}, Admin: ${adminUser.phoneNumber}`
          );
        }

        // Prepare update data
        const updateData: any = {
          updatedAt: new Date()
        };

        // Update institutionsId only if it's different
        if (user.institutionsId !== institutionId) {
          updateData.institutionsId = institutionId;
        }

        // Only set isVerified to true if institutionId exists AND phone numbers match
        // This should be updated even if institutionsId was already synced
        if (institutionId && phoneMatch) {
          updateData.isVerified = true;
        }

        // Skip if there's nothing to update
        // Check if institutionsId needs updating OR isVerified needs updating
        const needsInstitutionUpdate = user.institutionsId !== institutionId;
        const needsVerificationUpdate = institutionId && phoneMatch && !user.isVerified;
        
        if (!needsInstitutionUpdate && !needsVerificationUpdate) {
          skippedCount++;
          console.log(`⏭️  Skipping user ${user.userId} (${user.email}): No updates needed`);
          continue;
        }

        await dbService.users.findOneAndUpdate(
          { userId: user.userId, isDeleted: false },
          {
            $set: updateData
          }
        );

        syncedCount++;
        syncedUsers.push({
          userId: user.userId,
          email: user.email,
          institutionId: institutionId,
          phoneMatch: phoneMatch
        });

        console.log(
          `✅ [${syncedCount}/${users.length}] Synced institutionId for user ${user.userId} ` +
          `(${user.email}): ${institutionId} ${phoneMatch ? '(verified)' : '(not verified - phone mismatch)'}`
        );
      } catch (error) {
        failedCount++;
        console.error(`❌ Failed to sync user ${user.userId} (${user.email}):`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n🎉 Migration script completed!`);
    console.log(`   Total users with emails: ${users.length}`);
    console.log(`   Successfully synced: ${syncedCount}`);
    console.log(`   Skipped (no admin match or already synced): ${skippedCount}`);
    console.log(`   Failed: ${failedCount}`);
    console.log(`   Phone number mismatches: ${phoneMismatchCount}`);
    console.log('\n' + '='.repeat(60));

    // Show sample synced users
    if (syncedUsers.length > 0) {
      console.log('\n📝 Sample synced users (first 10):');
      syncedUsers.slice(0, 10).forEach((synced, index) => {
        console.log(
          `   ${index + 1}. User ${synced.userId} (${synced.email}) → ` +
          `institutionId: ${synced.institutionId} ${!synced.phoneMatch ? '⚠️' : '✓'}`
        );
      });
    }

    if (phoneMismatchCount > 0) {
      console.log('\n⚠️  Warning: Some users have phone number mismatches with their admin counterparts.');
      console.log('   Please review these cases manually.');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await app.close();
    process.exit(0);
  }
}

main();

