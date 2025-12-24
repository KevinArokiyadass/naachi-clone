/**
 * Script to update admin user names to proper Indian or UK names
 * 
 * This script:
 * 1. Fetches all admin users from the database
 * 2. Determines name type based on email domain:
 *    - Indian names: for emails with domains containing .in or .ac.in
 *    - UK names: for all other email domains
 * 3. Updates only the name field for each admin user
 * 
 * Usage:
 *   npm run update-admin-names
 * 
 * Requirements:
 *   - Environment variables must be set (.env file)
 *   - MongoDB connection must be available
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { IMongoDBServices } from '../src/common/repository/mongodb-repository/abstract.repository';
import { IAdminUser } from '../src/common/interfaces/admin-user.interface';

// UK admin names
const UK_ADMIN_NAMES = [
  'James Smith', 'Emily Johnson', 'Oliver Williams', 'Sophie Brown', 'Harry Jones',
  'Isabella Taylor', 'Charlie Davis', 'Amelia Wilson', 'George Miller', 'Grace Moore',
  'William Anderson', 'Lily Thomas', 'Henry Jackson', 'Charlotte White', 'Alexander Harris',
  'Olivia Martin', 'Daniel Thompson', 'Mia Garcia', 'Joseph Martinez', 'Ella Robinson',
  'Samuel Clark', 'Ava Rodriguez', 'Benjamin Lewis', 'Harper Lee', 'Matthew Walker',
  'Evelyn Hall', 'David Allen', 'Abigail Young', 'Michael King', 'Sofia Wright',
  'Thomas Lopez', 'Victoria Hill', 'Christopher Scott', 'Zoe Green', 'Daniel Adams',
  'Chloe Baker', 'Matthew Nelson', 'Emma Carter', 'Andrew Mitchell', 'Hannah Perez',
  'Joshua Roberts', 'Aria Turner', 'Ryan Phillips', 'Scarlett Campbell', 'Nathan Parker',
  'Luna Evans', 'Ethan Edwards', 'Layla Collins', 'Jacob Stewart', 'Nora Sanchez',
  'James Wilson', 'Charlotte Davies', 'Oliver Taylor', 'Sophia Moore', 'Harry Brown'
];

// Indian admin names
const INDIAN_ADMIN_NAMES = [
  'Rajesh Kumar', 'Priya Sharma', 'Amit Patel', 'Anjali Singh', 'Vikram Reddy',
  'Kavya Nair', 'Rahul Menon', 'Divya Iyer', 'Arjun Desai', 'Meera Joshi',
  'Suresh Rao', 'Lakshmi Venkatesh', 'Karthik Gopal', 'Shreya Krishnan', 'Nikhil Pillai',
  'Aditi Chaturvedi', 'Rohan Malhotra', 'Neha Agarwal', 'Siddharth Mehta', 'Pooja Shah',
  'Vishal Gupta', 'Ananya Reddy', 'Ravi Kumar', 'Swati Mishra', 'Deepak Verma',
  'Kiran Nair', 'Manish Tiwari', 'Sneha Das', 'Abhishek Banerjee', 'Ritu Agarwal',
  'Gaurav Saxena', 'Tanvi Kapoor', 'Harsh Jain', 'Isha Trivedi', 'Yash Patel',
  'Riya Sharma', 'Akash Singh', 'Nisha Reddy', 'Varun Kumar', 'Sakshi Gupta',
  'Mohit Agarwal', 'Anushka Shah', 'Rishabh Mehta', 'Kritika Joshi', 'Sahil Malhotra',
  'Aishwarya Nair', 'Rohit Iyer', 'Pallavi Rao', 'Aditya Menon', 'Shruti Krishnan',
  'Sanjay Verma', 'Radha Krishnan', 'Vijay Kumar', 'Sunita Devi', 'Nitin Agarwal'
];

/**
 * Determines if an email domain indicates Indian origin
 */
function isIndianDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  return domain.includes('.in') || domain.includes('.ac.in') || domain.includes('.edu.in');
}

/**
 * Gets a random name from the provided array
 */
function getRandomName(names: string[]): string {
  return names[Math.floor(Math.random() * names.length)];
}

/**
 * Gets an appropriate name based on email domain
 */
function getNameForEmail(email: string): string {
  if (isIndianDomain(email)) {
    return getRandomName(INDIAN_ADMIN_NAMES);
  } else {
    return getRandomName(UK_ADMIN_NAMES);
  }
}

async function main() {
  console.log('🚀 Starting admin name update script...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dbService = app.get<IMongoDBServices>(IMongoDBServices);

  try {
    // Fetch all admin users (excluding deleted ones)
    console.log('📋 Fetching all admin users...');
    const adminUsers = await dbService.adminUser.find(
      { isDeleted: { $in: [null, false] } }
    );

    console.log(`✅ Found ${adminUsers.length} admin users\n`);

    if (adminUsers.length === 0) {
      console.log('⚠️  No admin users found. Exiting...');
      await app.close();
      return;
    }

    let updatedCount = 0;
    let failedCount = 0;
    const updates: Array<{ adminId: string; oldName: string; newName: string; email: string }> = [];

    // Update each admin user's name
    for (const admin of adminUsers) {
      try {
        const oldName = admin.name;
        const newName = getNameForEmail(admin.email);
        const nameType = isIndianDomain(admin.email) ? 'Indian' : 'UK';

        // Update only the name field
        await dbService.adminUser.findOneAndUpdate(
          { adminId: admin.adminId },
          { name: newName },
          { new: true }
        );

        updatedCount++;
        updates.push({
          adminId: admin.adminId,
          oldName,
          newName,
          email: admin.email
        });

        console.log(`✅ [${updatedCount}/${adminUsers.length}] Updated: ${oldName} → ${newName} (${nameType}, ${admin.email})`);
      } catch (error) {
        failedCount++;
        console.error(`❌ Failed to update admin ${admin.adminId} (${admin.email}):`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n🎉 Script completed!`);
    console.log(`   Total admin users: ${adminUsers.length}`);
    console.log(`   Successfully updated: ${updatedCount}`);
    console.log(`   Failed: ${failedCount}`);
    console.log('\n' + '='.repeat(60));

    // Summary by name type
    const indianCount = updates.filter(u => isIndianDomain(u.email)).length;
    const ukCount = updates.filter(u => !isIndianDomain(u.email)).length;

    console.log('\n📊 Summary by name type:');
    console.log(`   Indian names: ${indianCount}`);
    console.log(`   UK names: ${ukCount}`);

    // Show sample updates
    if (updates.length > 0) {
      console.log('\n📝 Sample updates (first 10):');
      updates.slice(0, 10).forEach((update, index) => {
        const nameType = isIndianDomain(update.email) ? 'Indian' : 'UK';
        console.log(`   ${index + 1}. ${update.oldName} → ${update.newName} (${nameType})`);
      });
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await app.close();
    process.exit(0);
  }
}

main();

