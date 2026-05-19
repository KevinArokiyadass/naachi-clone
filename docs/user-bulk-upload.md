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
