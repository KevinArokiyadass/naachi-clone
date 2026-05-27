# Institution User Bulk Upload (Ops Guide)

## Endpoints

- `POST /api/naachi-user-service/users/{institutionsId}/bulk-upload`
- `GET /api/naachi-user-service/users/{institutionsId}/bulk-upload/template`

Auth: Cognito access token with `SUPER_ADMIN` or `INSTITUTION_ADMIN`.

## Upload request

Content-Type: `multipart/form-data`

Form fields:

- `file` (required): `.csv` or `.xlsx`
- `dryRun` (optional, default `false`): validate without write
- `skipExisting` (optional, default `true`): skip rows that match an existing user and cannot be auto-linked
- `updateExisting` (optional, default `false`): force update for any matched existing user (in addition to auto-link rules below)

**Auto-link (default, no flags required):** rows that match an existing user by **email** (preferred), or by **phone** when the stored user has no email, or when the user is a **global** user (no `institutionsId`), are **linked to the institution** via update instead of being rejected as duplicates. This covers global users joining via bulk upload and phone-only accounts that receive an email from the sheet.
- `includeCsvReport` (optional, default `true`): include base64 CSV report in response

`skipExisting` and `updateExisting` are mutually exclusive.

## Template columns

- `name` (required)
- `phoneNumber` (required)
- `email` (optional)
- `userName` (optional)
- `status` (optional: `active` | `blocked` | `pending`, default `active` when column is empty)

If the `status` cell is non-empty, it must be exactly one of `active`, `blocked`, or `pending` (case-insensitive). Invalid values are rejected.

## Response

Includes `reportFileName` and `reportCsvBase64` when `includeCsvReport=true`. Decode base64 to CSV for row-level success/failure.

## Limits

- Max file size: `5MB`
- Max rows: `5000`
- Phone without `+` is normalized with `+44` prefix

OTP is not sent at upload time; it is sent when the user starts the normal phone login flow.

## Verified tick (`isVerified`)

A user row gets `isVerified: true` only when its **email matches an admin** in Admin Management (same email, case-insensitive). Other institution users stay unverified. If the admin is created after the user, creating the admin record will verify the matching app user; if the user is bulk-uploaded after the admin exists, verification is applied on create/update.

## Remove user from institution (admin panel)

Admin panel must **not** hard-delete app users. Use these endpoints instead:

- `PATCH /api/naachi-user-service/users/{userId}/remove-from-institution`
- `POST /api/naachi-user-service/users/bulk-remove-from-institution` with body `{ "userIds": ["..."] }`

Behavior:

- Clears `institutionsId` and `departmentsId` (user returns to **Global Users**).
- Removes institutional `email`, email OTP fields, and `metaData`; sets `emailVerified` and `isVerified` to `false`.
- Clears the institutional email from Cognito when one was stored on the profile.
- Keeps `referrerMedium` / `referredBy` as historical data.
- Does **not** set `isDeleted`, anonymize, or remove the user from Cognito.
- Calls chat service `DELETE /group-member/user/{userId}?institutionsId={id}` to remove the user from institution-scoped groups.
- Only affects the **user-level** profile. If the same email also has an admin record (e.g. a professor with both profiles), the admin record (`AdminUser` collection, `isVerifiedAdmin`, `metaTags`) is **left untouched** — admin access is managed separately.

The previous admin routes `PATCH .../delete-user` and `POST .../bulk-delete` are removed. Full account deletion is reserved for the end user (self-delete), not the admin panel.
