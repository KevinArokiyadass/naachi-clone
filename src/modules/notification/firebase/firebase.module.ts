// firebase.module.ts
import { Module } from '@nestjs/common';
import { FirebaseService } from './firebase.service';
import { createFirebaseApp, createFirebaseMessaging } from './firebase.providers';

@Module({
  providers: [
    { provide: 'FIREBASE_APP', useFactory: createFirebaseApp },
    { provide: 'FIREBASE_MESSAGING', useFactory: createFirebaseMessaging, inject: ['FIREBASE_APP'] },
    FirebaseService,
  ],
  exports: [FirebaseService, 'FIREBASE_APP', 'FIREBASE_MESSAGING'],
})
export class FirebaseModule {}