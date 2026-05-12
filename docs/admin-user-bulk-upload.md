# Admin User Bulk Upload

## Endpoint

- `POST /api/naachi-user-service/admin-user/bulk-upload`
- Auth: Cognito access token + `SUPER_ADMIN` role
- Content-Type: `multipart/form-data`

## Form fields

- `file` (required): `csv` or `xlsx`
- `dryRun` (optional, default `false`): validates and simulates only
- `skipExisting` (optional, default `true`): skip rows that already exist
- `updateExisting` (optional, default `false`): update rows that already exist
- `defaultRegion` (optional): metadata passthrough
- `source` (optional): metadata passthrough

`skipExisting` and `updateExisting` are mutually exclusive.

## Supported headers

- `name`
- `firstName`
- `lastName`
- `email` (required)
- `userName`
- `password` (required)
- `phoneNumber`
- `role` (required: `SUPER_ADMIN` | `ADMIN` | `INSTITUTION_ADMIN`)
- `status` (`active` | `inactive`)
- `permissionGroupsId` (comma-separated ids)
- `institutionsId`
- `departmentsId` (comma-separated ids)
- `s3ProfileImageName`

## Response

```json
{
  "totalRows": 120,
  "processedRows": 120,
  "successCount": 103,
  "failureCount": 17,
  "duplicateCount": 9,
  "errors": [
    {
      "rowNumber": 6,
      "field": "email",
      "code": "DUPLICATE_IN_FILE",
      "message": "Duplicate email in file, first seen at row 4."
    }
  ],
  "createdIds": ["adm_001", "adm_002"],
  "updatedIds": ["adm_013"],
  "dryRun": false
}
```

## Error codes

- `INVALID_FILE_FORMAT`
- `MISSING_REQUIRED_FIELD`
- `INVALID_FIELD_FORMAT`
- `DUPLICATE_IN_FILE`
- `DUPLICATE_IN_DB`
- `BUSINESS_RULE_VIOLATION`
- `INTERNAL_PROCESSING_ERROR`

## Limits and assumptions

- Maximum rows: `5000`
- Maximum file size: `5MB`
- Batch size: `50`
- Duplicate-in-file policy: first row wins, later duplicate rows fail deterministically
- Idempotency:
  - create flow is naturally idempotent with `skipExisting=true`
  - update flow is retry-safe with `updateExisting=true`

