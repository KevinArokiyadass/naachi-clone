# Admin User Bulk Upload Flow

## Flow

1. Parse `csv`/`xlsx` file into row objects.
2. Normalize fields (`email`, `phone`, delimited ids, role/status canonicalization).
3. Validate schema and business rules row-by-row.
4. Detect duplicates:
   - within file (`email`)
   - against DB (`email`, `userName`, `phoneNumber`)
5. Process in batches (`50` rows per batch) with partial success.
6. Create or update based on `skipExisting` / `updateExisting`.
7. Return row-level error details and aggregate counts.

## Assumptions

- Entity is `admin-user`.
- Business key for idempotency is `email`.
- First duplicate row in file is accepted; subsequent duplicate rows fail.
- `skipExisting` and `updateExisting` are mutually exclusive.

## Limits

- Max rows: `5000`
- Max file size: `5MB`
- Accepted formats: `.csv`, `.xlsx`

## Error codes

- `INVALID_FILE_FORMAT`
- `MISSING_REQUIRED_FIELD`
- `INVALID_FIELD_FORMAT`
- `DUPLICATE_IN_FILE`
- `DUPLICATE_IN_DB`
- `BUSINESS_RULE_VIOLATION`
- `INTERNAL_PROCESSING_ERROR`

