import * as admin from 'firebase-admin';

export function createFirebaseApp(): admin.app.App {
  // Initialize using individual environment variables only
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_CLIENT_EMAIL
  ) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY as string;
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      throw new Error('Invalid private key format. Missing BEGIN/END markers.');
    }

    // Create a minimal service account object with only required fields
    const serviceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: privateKey,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      // Optional fields - only include if they exist
      ...(process.env.FIREBASE_PRIVATE_KEY_ID && { private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID }),
      ...(process.env.FIREBASE_CLIENT_ID && { client_id: process.env.FIREBASE_CLIENT_ID }),
      ...(process.env.FIREBASE_CLIENT_X509_CERT_URL && { client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL }),
    };

    try {
      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      });
    } catch (error) {
      console.error('Firebase initialization error:', error);
      throw new Error(`Failed to initialize Firebase: ${error.message}`);
    }
  }

  throw new Error(
    'Firebase credentials are not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.'
  );
}

export function createFirebaseMessaging(app: admin.app.App): admin.messaging.Messaging {
  return app.messaging();
}


