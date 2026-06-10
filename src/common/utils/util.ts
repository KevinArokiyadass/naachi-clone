import { customAlphabet } from 'nanoid';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

/**
 * Creates a custom nanoid generator with alphanumeric characters
 * @returns A function that generates a 10-character unique ID
 */
export const generateNanoid = 
customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',16);

/**
 * Generates a unique ID using nanoid
 * @returns A 10-character unique ID
 */
export const generateUniqueId = (): string => {
  return generateNanoid();
}; 

export const generateOtp = (length = 6): string => {
  return Math.floor(Math.random() * Math.pow(10, length))
    .toString()
    .padStart(length, '0');
}

export const generateReferralCodeString = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  6
);


export const generateSecretHash = (
  username: string,
  clientId: string,
  clientSecret: string,
):string => {
  return crypto
    .createHmac('sha256', clientSecret)
    .update(username + clientId)
    .digest('base64');
}

/**
 * Generates a secure random password
 * @param length - Length of the password (default: 12)
 * @returns A secure random password
 */
export const generateRandomPassword = (length: number = 12): string => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  const allChars = uppercase + lowercase + numbers + symbols;
  
  let password = '';
  
  // Ensure at least one character from each category
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest with random characters
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password to avoid predictable patterns
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

export const hashPassword = async (password: string, saltRounds: number = 10): Promise<string> => {
  return bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

export const generateResetToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export function normalizeUserName(value: string): string {
  if (!value) return value;
  return value.trim().toLowerCase();
}

const USERNAME_SCHEMA_REGEX =
  /^(?!.*\.\.)(?!\.)(?!.*\.$)[A-Za-z0-9._]{1,30}$/;

const TEMP_USERNAME_MAX_LENGTH = 30;
const TEMP_USERNAME_SUFFIX_LENGTH = 6;
const TEMP_USERNAME_FALLBACK_PREFIX = 'user';

const generateTempUsernameSuffix = customAlphabet(
  '0123456789abcdefghijklmnopqrstuvwxyz',
  TEMP_USERNAME_SUFFIX_LENGTH,
);

export function deriveTempUsernamePrefix(displayName: string): string {
  const firstWord = (displayName || '').trim().split(/\s+/)[0] || '';
  const sanitized = firstWord
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  if (!sanitized) {
    return TEMP_USERNAME_FALLBACK_PREFIX;
  }

  const maxPrefixLength =
    TEMP_USERNAME_MAX_LENGTH - 1 - TEMP_USERNAME_SUFFIX_LENGTH;
  return sanitized.slice(0, maxPrefixLength);
}

export const generateUniqueTemporaryUserName = async (
  displayName: string,
  dbService: { users: { findOne: (query: object) => Promise<unknown | null> } },
): Promise<string> => {
  const prefix = deriveTempUsernamePrefix(displayName);

  let attempts = 0;
  const maxAttempts = 50;

  while (attempts < maxAttempts) {
    const userName = `${prefix}_${generateTempUsernameSuffix()}`;
    if (USERNAME_SCHEMA_REGEX.test(userName)) {
      const existingUser = await dbService.users.findOne({
        userName,
        isDeleted: false,
      });
      if (!existingUser) {
        return userName;
      }
    }
    attempts++;
  }

  throw new Error('Failed to generate a unique temporary username');
};

export const generateUniqueUserNameFromEmail = async (
  email: string,
  dbService: any,
  prefix: string = 'NA'
): Promise<string> => {
  const baseName = email.split('@')[0]; 
  let userName: string;
  let isUnique = false;

  while (!isUnique) {
    const randomNumber = Math.floor(1000 + Math.random() * 9000);
    userName = `${prefix}_${baseName}${randomNumber}`;

    const existingUser = await dbService.adminUser.findOne({ userName });
    if (!existingUser) {
      isUnique = true;
    }
  }

  return userName;
};

