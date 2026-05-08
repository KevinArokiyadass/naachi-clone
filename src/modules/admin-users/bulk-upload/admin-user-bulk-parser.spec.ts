import * as XLSX from 'xlsx';
import { AdminUserBulkParser } from './admin-user-bulk-parser';

describe('AdminUserBulkParser', () => {
  const parser = new AdminUserBulkParser();

  it('parses csv payload', () => {
    const csv = 'Name,phoneNumber,email id,status,select permission,select department,create password,confirm password\nJohn Admin,7912345678,john@naachi.com,active,Marketing,Operations,Password@123,Password@123';
    const file = {
      buffer: Buffer.from(csv),
      originalname: 'admins.csv',
      mimetype: 'text/csv',
    } as Express.Multer.File;

    const rows = parser.parse(file);
    expect(rows).toHaveLength(1);
    expect(rows[0].data.email).toBe('john@naachi.com');
  });

  it('parses xlsx payload', () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      {
        Name: 'John Admin',
        phoneNumber: '7912345678',
        'email id': 'a@b.com',
        status: 'active',
        'select permission': 'Marketing',
        'select department': 'Operations',
        'create password': 'Password@123',
        'confirm password': 'Password@123',
      },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const file = {
      buffer,
      originalname: 'admins.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    } as Express.Multer.File;

    const rows = parser.parse(file);
    expect(rows).toHaveLength(1);
    expect(rows[0].data.password).toBe('Password@123');
  });
});

