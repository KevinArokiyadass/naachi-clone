import * as fs from 'fs';
import * as path from 'path';
import * as admin from 'firebase-admin';
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';

@Injectable()
export class FirebaseConfig implements OnModuleInit {
  private readonly logger = new Logger(FirebaseConfig.name);
  private initialized = false;

  async onModuleInit(): Promise<void> {
    await this.initialize();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // If already initialized by another process, reuse it
      if (admin.apps.length > 0) {
        this.logger.log('Firebase Admin SDK already initialized - reusing existing app');
        this.initialized = true;
        return;
      }

      // Check for individual Firebase environment variables first (recommended for production)
      if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
        this.logger.log('Using Firebase configuration from environment variables');
        const serviceAccount: admin.ServiceAccount = {
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL
        };

        // Initialize app with environment-based service account
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        this.initialized = true;
        this.logger.log('Firebase Admin SDK initialized successfully from environment variables');
        return;
      }

      // Fallback 1: GOOGLE_APPLICATION_CREDENTIALS env var
      const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      let serviceAccount: admin.ServiceAccount | null = null;

      if (envPath) {
        const resolved = path.isAbsolute(envPath) ? envPath : path.join(process.cwd(), envPath);
        this.logger.log(`Using GOOGLE_APPLICATION_CREDENTIALS at: ${resolved}`);
        const raw = fs.readFileSync(resolved, 'utf8');
        serviceAccount = JSON.parse(raw);
      } else {
        // Fallback 2: allow path to JSON inside repo (not recommended for production)
        const candidate = path.join(process.cwd(), 'src', 'common', 'config', 'naga-sfa-mobile-app-0804569b6dac.json');
        if (fs.existsSync(candidate)) {
          this.logger.log(`Loading Firebase service account from: ${candidate}`);
          serviceAccount = require(candidate) as admin.ServiceAccount;
        } else {
          throw new Error('No Firebase service account found. Set Firebase environment variables, GOOGLE_APPLICATION_CREDENTIALS, or place JSON at expected path.');
        }
      }

      // Initialize app (synchronous)
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

      this.initialized = true;
      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error as any);
      throw error;
    }
  }

  // Synchronous getter — ensures initialized (awaited when necessary)
  async getMessaging(): Promise<admin.messaging.Messaging> {
    if (!this.initialized) {
      await this.initialize();
    }
    if (!admin.apps.length) throw new Error('Firebase admin not initialized');
    return admin.messaging();
  }

  async getApp(): Promise<admin.app.App> {
    if (!this.initialized) {
      await this.initialize();
    }
    return admin.app();
  }
}
