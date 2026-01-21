/**
 * Script to create 10 users for each institution (PARALLEL PROCESSING)
 * 
 * This script:
 * 1. Fetches all institutions from the database
 * 2. For each institution, creates 10 users in parallel batches (5 at a time):
 *    - UK Universities (.edu.uk):
 *      * UK phone numbers (+44)
 *      * Mix of UK and Indian names (60% UK, 40% Indian)
 *      * Roll number emails (e.g., b16016, b17017)
 *    - Indian Universities (.edu.in):
 *      * Indian phone numbers (+91)
 *      * Indian names only
 *      * Roll number emails (e.g., b16016, b17017)
 * 3. Completes the full signup flow for each user in parallel:
 *    - Signup with phone number
 *    - Verify signup OTP (643211)
 *    - Set username
 *    - Verify email
 *    - Confirm email with OTP (643211)
 * 
 * Email Format:
 *   - Uses roll numbers like b16016 (batch 16, roll 16), b17017, etc.
 *   - Different universities may use different formats
 * 
 * Usage:
 *   npm run create-users
 * 
 * Requirements:
 *   - Environment variables must be set (.env file)
 *   - MongoDB connection must be available
 *   - AWS Cognito must be configured
 *   - Institutions must have institutionDomain set
 * 
 * Performance:
 *   - Processes users in batches of 5 in parallel
 *   - Much faster than sequential processing
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UsersAuthService } from '../src/modules/users/users.service';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { IMongoDBServices } from '../src/common/repository/mongodb-repository/abstract.repository';
import { ReferrerMedium, USER_STATUS } from '../src/common/enums/user.enum';

// UK student names
const UK_STUDENT_NAMES = [
  'James Smith', 'Emily Johnson', 'Oliver Williams', 'Sophie Brown', 'Harry Jones',
  'Isabella Taylor', 'Charlie Davis', 'Amelia Wilson', 'George Miller', 'Grace Moore',
  'William Anderson', 'Lily Thomas', 'Henry Jackson', 'Charlotte White', 'Alexander Harris',
  'Olivia Martin', 'Daniel Thompson', 'Mia Garcia', 'Joseph Martinez', 'Ella Robinson',
  'Samuel Clark', 'Ava Rodriguez', 'Benjamin Lewis', 'Harper Lee', 'Matthew Walker',
  'Evelyn Hall', 'David Allen', 'Abigail Young', 'Michael King', 'Sofia Wright',
  'Thomas Lopez', 'Victoria Hill', 'Christopher Scott', 'Zoe Green', 'Daniel Adams',
  'Chloe Baker', 'Matthew Nelson', 'Emma Carter', 'Andrew Mitchell', 'Hannah Perez',
  'Joshua Roberts', 'Aria Turner', 'Ryan Phillips', 'Scarlett Campbell', 'Nathan Parker',
  'Luna Evans', 'Ethan Edwards', 'Layla Collins', 'Jacob Stewart', 'Nora Sanchez'
];

// Indian student names
const INDIAN_STUDENT_NAMES = [
  'Rajesh Kumar', 'Priya Sharma', 'Amit Patel', 'Anjali Singh', 'Vikram Reddy',
  'Kavya Nair', 'Rahul Menon', 'Divya Iyer', 'Arjun Desai', 'Meera Joshi',
  'Suresh Rao', 'Lakshmi Venkatesh', 'Karthik Gopal', 'Shreya Krishnan', 'Nikhil Pillai',
  'Aditi Chaturvedi', 'Rohan Malhotra', 'Neha Agarwal', 'Siddharth Mehta', 'Pooja Shah',
  'Vishal Gupta', 'Ananya Reddy', 'Ravi Kumar', 'Swati Mishra', 'Deepak Verma',
  'Kiran Nair', 'Manish Tiwari', 'Sneha Das', 'Abhishek Banerjee', 'Ritu Agarwal',
  'Gaurav Saxena', 'Tanvi Kapoor', 'Harsh Jain', 'Isha Trivedi', 'Yash Patel',
  'Riya Sharma', 'Akash Singh', 'Nisha Reddy', 'Varun Kumar', 'Sakshi Gupta',
  'Mohit Agarwal', 'Anushka Shah', 'Rishabh Mehta', 'Kritika Joshi', 'Sahil Malhotra',
  'Aishwarya Nair', 'Rohit Iyer', 'Pallavi Rao', 'Aditya Menon', 'Shruti Krishnan'
];

// Random college names
const COLLEGE_NAMES = [
  'Oxford', 'Cambridge', 'Imperial', 'Edinburgh', 'Manchester',
  'Bristol', 'Warwick', 'Durham', 'York', 'Leeds',
  'Nottingham', 'Birmingham', 'Southampton', 'Newcastle', 'Sheffield',
  'Liverpool', 'Cardiff', 'Glasgow', 'Aberdeen', 'StAndrews',
  'Bath', 'Exeter', 'Lancaster', 'Reading', 'Sussex',
  'Kent', 'Essex', 'Surrey', 'Hull', 'Leicester'
];

// Check if institution is UK based on domain
function isUKInstitution(domain: string): boolean {
  const normalized = normalizeDomain(domain);
  return normalized.endsWith('.edu.uk') || normalized.endsWith('.ac.uk');
}

// Generate UK phone number
function generateUKPhoneNumber(): string {
  const prefix = '+44';
  const areaCode = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
  const number = Math.floor(Math.random() * 900000) + 100000; // 100000-999999
  return `${prefix}${areaCode}${number}`;
}

// Generate Indian phone number
function generateIndianPhoneNumber(): string {
  const prefix = '+91';
  const areaCode = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
  const number = Math.floor(Math.random() * 9000000) + 1000000; // 1000000-9999999
  return `${prefix}${areaCode}${number}`;
}

// Generate random username (college name + student name)
function generateUsername(index: number, isUK: boolean): { userName: string; name: string } {
  const college = COLLEGE_NAMES[Math.floor(Math.random() * COLLEGE_NAMES.length)];
  
  // For UK universities, use mix of UK and Indian names
  // For Indian universities, use only Indian names
  let student: string;
  if (isUK) {
    // 60% UK names, 40% Indian names for UK universities
    const namePool = Math.random() < 0.6 ? UK_STUDENT_NAMES : INDIAN_STUDENT_NAMES;
    student = namePool[Math.floor(Math.random() * namePool.length)];
  } else {
    student = INDIAN_STUDENT_NAMES[Math.floor(Math.random() * INDIAN_STUDENT_NAMES.length)];
  }
  
  const studentNameParts = student.toLowerCase().split(' ');
  // Add index to ensure uniqueness
  const userName = `${college.toLowerCase()}.${studentNameParts[0]}.${studentNameParts[1]}.${index}`.replace(/[^a-z0-9.]/g, '');
  return { userName, name: student };
}

// Normalize institution domain (remove @ prefix if present)
function normalizeDomain(domain: string): string {
  if (!domain) return domain;
  return domain.trim().replace(/^@+/, '').toLowerCase();
}

// Generate roll number email (like b16016, b17017, etc.)
function generateRollNumberEmail(institutionDomain: string, index: number): string {
  const normalizedDomain = normalizeDomain(institutionDomain);
  
  // Generate roll number format: b[year][roll]
  // Year: 16-24 (2016-2024), Roll: 001-999
  const year = Math.floor(Math.random() * 9) + 16; // 16-24
  const roll = String(index).padStart(3, '0'); // 001, 002, etc.
  
  // Different formats for different universities
  const formats = [
    `b${year}${roll}`,           // b16016, b17017
    `b${year}${String(Math.floor(Math.random() * 900) + 100)}`, // b16123, b17234
    `b${year}${roll}${String.fromCharCode(97 + Math.floor(Math.random() * 26))}`, // b16016a
  ];
  
  const emailPrefix = formats[Math.floor(Math.random() * formats.length)];
  return `${emailPrefix}@${normalizedDomain}`;
}

// Create a single user with full signup flow
async function createSingleUser(
  usersService: UsersAuthService,
  dbService: IMongoDBServices,
  institution: any,
  institutionDomain: string,
  index: number,
  OTP: string,
  isUK: boolean,
  referrerUserId: string,
  referrerUserName: string
): Promise<any> {
  try {
    // Generate user data based on institution type
    const phoneNumber = isUK ? generateUKPhoneNumber() : generateIndianPhoneNumber();
    const { userName, name } = generateUsername(index, isUK);
    const email = generateRollNumberEmail(institutionDomain, index);

    // Step 1: Signup
    const signupResponse = await usersService.signup({ phoneNumber });
    const userId = signupResponse.userId;
    const session = signupResponse.session;

    // Step 2: Verify Signup OTP
    const verifySignupResponse = await usersService.verifySignupOtp({
      phoneNumber,
      otp: OTP,
      session
    });

    const accessToken = verifySignupResponse.tokens.AccessToken;

    // Step 3: Set Username (with retry if username is taken)
    let finalUserName = userName;
    let retryCount = 0;
    const maxRetries = 5;
    
    while (retryCount < maxRetries) {
      try {
        await usersService.setUsername({
          userId,
          userName: finalUserName,
          name
        });
        break;
      } catch (error) {
        if (error.message && error.message.includes('already taken')) {
          retryCount++;
          const randomSuffix = Math.floor(Math.random() * 10000);
          finalUserName = `${userName}.${randomSuffix}`;
        } else {
          throw error;
        }
      }
    }
    
    if (retryCount >= maxRetries) {
      throw new Error('Failed to set username after multiple retries');
    }

    // Step 4: Verify Email (bypass if email limit exceeded)
    let emailLimitExceeded = false;
    try {
      await usersService.verifyEmail({
        userId,
        email,
        accessToken
      });
    } catch (error) {
      // If email limit exceeded, bypass and directly mark as completed
      if (error.message && (error.message.includes('LimitExceededException') || 
          (error.response && error.response['$metadata'] && error.response['$metadata'].httpStatusCode === 400))) {
        emailLimitExceeded = true;
        console.log(`   ⚠️  Email limit exceeded for ${email}, bypassing verification`);
      } else {
        throw error;
      }
    }

    // Step 5: Confirm Email or Bypass
    if (emailLimitExceeded) {
      // Directly update user to completed status, bypassing email verification
      // Use the institution ID from the institution parameter
      const institutionsId = institution.institutionsId;
      
      // Check if there's a matching admin user with same email and phone number
      const adminUser = await dbService.adminUser.findOne({
        email: email.toLowerCase().trim(),
        isDeleted: { $ne: true }
      });
      
      // Only set isVerified to true if admin user exists and phone numbers match
      const phoneMatch = adminUser && adminUser.phoneNumber && phoneNumber &&
        adminUser.phoneNumber.trim() === phoneNumber.trim();
      
      // Directly update user to completed/active status in database
      await dbService.users.findOneAndUpdate(
        { userId, status: USER_STATUS.PENDING },
        {
          email: email,
          institutionsId: institutionsId,
          emailVerified: true,
          status: USER_STATUS.ACTIVE,
          isVerified: phoneMatch || false, // Only true if phone numbers match
          referrerId: referrerUserId,
          referredBy: referrerUserName,
          referrerMedium: ReferrerMedium.INSTITUTION_MAIL,
          qrAuth: false,
          updatedAt: new Date()
        }
      );
    } else {
      // Normal flow: Confirm Email with OTP
      await usersService.confirmEmail({
        userId,
        email,
        confirmationCode: OTP,
        accessToken
      });
      
      // Update referrer info after email confirmation
      await dbService.users.findOneAndUpdate(
        { userId, status: USER_STATUS.ACTIVE },
        {
          referrerId: referrerUserId,
          referredBy: referrerUserName,
          updatedAt: new Date()
        }
      );
    }

    return {
      userId,
      phoneNumber,
      userName: finalUserName,
      name,
      email,
      institutionsId: institution.institutionsId
    };
  } catch (error) {
    throw { index, error: error.message || error };
  }
}

// Find or create a referrer user without institution
async function getOrCreateReferrerUser(
  usersService: UsersAuthService,
  dbService: IMongoDBServices,
  connection: Connection
): Promise<{ userId: string; userName: string }> {
  // First, try to find an existing user without institution
  const existingReferrer = await dbService.users.findOne({
    isDeleted: false,
    status: USER_STATUS.ACTIVE,
    $or: [
      { institutionsId: { $exists: false } },
      { institutionsId: null }
    ]
  });

  if (existingReferrer) {
    return {
      userId: existingReferrer.userId,
      userName: existingReferrer.userName || existingReferrer.userId
    };
  }

  // Create a new referrer user without institution
  console.log('📝 Creating referrer user (no institution)...');
  const phoneNumber = generateUKPhoneNumber();
  const OTP = '643211';
  
  const signupResponse = await usersService.signup({ phoneNumber });
  const userId = signupResponse.userId;
  const session = signupResponse.session;

  const verifyResponse = await usersService.verifySignupOtp({
    phoneNumber,
    otp: OTP,
    session
  });

  const userName = `referrer.${Math.floor(Math.random() * 10000)}`;
  await usersService.setUsername({
    userId,
    userName,
    name: 'Referrer User'
  });

      // Mark as completed/active without institution (no email needed for referrer)
  await dbService.users.findOneAndUpdate(
    { userId, status: USER_STATUS.PENDING },
    {
      emailVerified: true,
      status: USER_STATUS.ACTIVE,
      isVerified: true,
      updatedAt: new Date()
    }
  );

  console.log(`✅ Referrer user created: ${userName} (${userId})`);
  return { userId, userName };
}

async function createUsersForInstitution(
  usersService: UsersAuthService,
  dbService: IMongoDBServices,
  connection: Connection,
  institution: any,
  count: number = 10,
  batchSize: number = 5,
  referrerUserId: string,
  referrerUserName: string
) {
  const institutionName = institution.institutionName || 'Unknown';
  const rawDomain = institution.institutionDomain;
  const institutionDomain = normalizeDomain(rawDomain);
  const isUK = isUKInstitution(institutionDomain);
  
  console.log(`\n📚 Creating ${count} users for institution:`);
  console.log(`   Name: ${institutionName}`);
  console.log(`   ID: ${institution.institutionsId}`);
  console.log(`   Domain: ${institutionDomain || 'N/A'}`);
  console.log(`   Type: ${isUK ? 'UK University' : 'Indian University'}`);
  
  if (!institutionDomain) {
    console.log(`⚠️  Skipping institution ${institution.institutionsId} - no institutionDomain found`);
    return;
  }

  const OTP = '643211';
  const createdUsers = [];
  const errors = [];

  // Process users in parallel batches
  for (let batchStart = 0; batchStart < count; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, count);
    const batchNumber = Math.floor(batchStart / batchSize) + 1;
    const totalBatches = Math.ceil(count / batchSize);
    
    console.log(`\n🔄 Processing batch ${batchNumber}/${totalBatches} (users ${batchStart + 1}-${batchEnd})...`);

    // Create promises for this batch
    const batchPromises = [];
    for (let i = batchStart; i < batchEnd; i++) {
      batchPromises.push(
        createSingleUser(usersService, dbService, institution, institutionDomain, i + 1, OTP, isUK, referrerUserId, referrerUserName)
          .then(result => ({ success: true, index: i + 1, result }))
          .catch(error => ({ success: false, index: i + 1, error }))
      );
    }

    // Wait for all users in batch to complete
    const batchResults = await Promise.all(batchPromises);

    // Process results
    for (const result of batchResults) {
      if (result.success) {
        createdUsers.push(result.result);
        console.log(`   ✅ User ${result.index} created: ${result.result.userName}`);
      } else {
        const errorMsg = typeof result.error === 'object' && result.error.error 
          ? result.error.error 
          : (typeof result.error === 'string' ? result.error : JSON.stringify(result.error));
        errors.push({ index: result.index, error: errorMsg });
        console.log(`   ❌ User ${result.index} failed: ${errorMsg}`);
      }
    }

    // Small delay between batches to avoid overwhelming the system
    if (batchEnd < count) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n✅ Successfully created ${createdUsers.length}/${count} users for institution ${institution.institutionsId}`);
  if (errors.length > 0) {
    console.log(`⚠️  ${errors.length} users failed to create`);
  }
  return createdUsers;
}

async function main() {
  console.log('🚀 Starting user creation script...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  
  // Get MongoDB connection - default connection
  const connection = app.get<Connection>(getConnectionToken());
  const usersService = app.get(UsersAuthService);
  const dbService = app.get(IMongoDBServices);

  try {
    // Get all institutions directly from MongoDB
    console.log('📋 Fetching all institutions...');
    const institutionsCollection = connection.collection('institutions');
    const institutions = await institutionsCollection
      .find(
        { isDeleted: false }, // Only get active institutions
        { projection: { institutionsId: 1, institutionDomain: 1, institutionName: 1 } }
      )
      .toArray();

    console.log(`✅ Found ${institutions.length} institutions\n`);

    if (institutions.length === 0) {
      console.log('⚠️  No institutions found. Exiting...');
      await app.close();
      return;
    }

    // Get or create referrer user (without institution)
    const referrer = await getOrCreateReferrerUser(usersService, dbService, connection);
    console.log(`\n👤 Using referrer: ${referrer.userName} (${referrer.userId})\n`);

    const allCreatedUsers = [];

    // Create 10 users for each institution
    for (const institution of institutions) {
      const users = await createUsersForInstitution(
        usersService,
        dbService,
        connection,
        institution,
        10,
        5,
        referrer.userId,
        referrer.userName
      );
      if (users) {
        allCreatedUsers.push(...users);
      }
      
      // Add delay between institutions to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n🎉 Script completed!`);
    console.log(`   Total institutions processed: ${institutions.length}`);
    console.log(`   Total users created: ${allCreatedUsers.length}`);
    console.log('\n' + '='.repeat(60));

    // Summary by institution
    const summary = new Map<string, number>();
    allCreatedUsers.forEach(user => {
      const count = summary.get(user.institutionsId) || 0;
      summary.set(user.institutionsId, count + 1);
    });

    console.log('\n📊 Summary by institution:');
    summary.forEach((count, institutionsId) => {
      console.log(`   ${institutionsId}: ${count} users`);
    });

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await app.close();
    process.exit(0);
  }
}

main();

