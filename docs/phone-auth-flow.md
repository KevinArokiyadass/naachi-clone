# Phone OTP Signup & Login Flow

This document summarizes how the Cognito + Lambda backed phone authentication works after integrating the legacy sample flow.

## Signup (Phone OTP)
1. **POST** `users-phone-auth/signup`
   - Body: `UsersSignupDto` (phoneNumber, email, userName, Name)
   - Validates phone/email/username uniqueness in `users` collection.
   - Creates a pending user (`status: 'pending'`, `phoneVerified: false`).
   - Registers the user in Cognito and triggers the custom auth Lambda to send the static OTP.
   - Returns `{ challengeName, session }` for OTP confirmation.
2. **POST** `users-phone-auth/signup/verify`
   - Body: `UsersVerifySignupDto` (phoneNumber, otp, session).
   - Calls `RespondToAuthChallengeCommand` (lambda expects the static OTP that was configured).
   - On success, marks `phoneVerified: true`, activates the user, and returns Cognito tokens + the user record.
3. **POST** `users-phone-auth/signup/resend-otp`
   - Body: `{ phoneNumber }`.
   - Uses Cognito `ResendConfirmationCodeCommand` so Lambda re-sends the same static OTP.

> **Note:** `status` remains `pending` until the user finishes the email-verification flow (`users-auth/*` endpoints). Only then does `complete-signup` mark them as `completed`.

## Login (Phone OTP)
1. **POST** `users-phone-auth/login`
   - Body: `{ phoneNumber }`.
   - Requires an existing user with `status === 'completed'`.
   - Triggers the custom auth flow to send the static OTP through the Lambda.
2. **POST** `users-phone-auth/login/verify`
   - Body: `UsersVerifyLoginDto` (phoneNumber, otp, session).
   - Responds to the custom challenge and, on success, returns Cognito tokens plus the latest user snapshot.

## Token Maintenance
- **POST** `users-phone-auth/refresh-token` — wraps `InitiateAuthCommand` with `REFRESH_TOKEN_AUTH`.
- **POST** `users-phone-auth/logout` — revokes the refresh token and performs a global sign-out when the access token is valid.
- **POST** `users-phone-auth/generate-jwt` — creates an application JWT (365d expiry) for a given `userId` by reading the user from Mongo and signing via `JwtService`.

## Lambda OTP Expectations
- The Cognito user pool must have the custom auth Lambda trigger configured to emit the **static OTP** you set up for testing.
- Because Lambda always validates against that static OTP, the service never generates or stores OTPs locally; it purely relays between the client and Cognito.
- When you move away from static OTPs, only the Lambda needs to change—this service simply forwards the OTP value the user enters.

