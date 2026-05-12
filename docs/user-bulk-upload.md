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
- `skipExisting` (optional, default `true`): duplicate phone rows reported as skipped
- `updateExisting` (optional, default `false`): update existing user by phone
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
