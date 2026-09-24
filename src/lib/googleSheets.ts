import { google } from 'googleapis';
import { EventRecord, ImportBatch } from './types';
import { getSettings } from './db';

// Header row definitions matching BRD / Razorpay mapping
export const PASS_SHEET_HEADERS = [
  'Record ID',
  'Order ID',
  'Code',
  'Payment Page ID',
  'Payment Page Title',
  'Payment Date',
  'Item Name',
  'Item Amount',
  'No. of Passes',
  'Item Payment Amount',
  'Total Payment Amount',
  'Currency',
  'Payment Status',
  'Payment ID',
  'Email',
  'Phone',
  'Name',
  'PAN Number',
  'Divisions',
  'L2',
  'Referred Volunteer',
  'Imported At',
  'Email Status',
  'Email Sent At',
  'Import Batch',
];

export const DONATION_SHEET_HEADERS = [
  'Record ID',
  'Order ID',
  'Code',
  'Payment Page ID',
  'Payment Page Title',
  'Payment Date',
  'Item Name',
  'Item Amount',
  'Item Payment Amount',
  'Total Payment Amount',
  'Currency',
  'Payment Status',
  'Payment ID',
  'Email',
  'Phone',
  'Name',
  'PAN Number',
  'Divisions',
  'L2',
  'Referred Volunteer',
  'Imported At',
  'Email Status',
  'Email Sent At',
  'Import Batch',
];

export const IMPORT_LOG_HEADERS = [
  'Import ID',
  'File Name',
  'Imported At',
  'Total Rows',
  'Captured Rows',
  'Pass Transactions',
  'Total Passes',
  'Donation Transactions',
  'Donation Amount',
  'Duplicates Skipped',
  'Errors',
  'Status',
];

export function recordToPassRow(record: EventRecord): (string | number)[] {
  return [
    record.id,
    record.order_id,
    record.code || '',
    record.payment_page_id || '',
    record.payment_page_title || '',
    record.payment_date || '',
    record.item_name,
    record.item_amount,
    record.item_quantity,
    record.item_payment_amount,
    record.total_payment_amount,
    record.currency,
    record.payment_status,
    record.payment_id || '',
    record.email || '',
    record.phone || '',
    record.name || '',
    record.pan_number || '',
    record.divisions || '',
    record.l2 || '',
    record.referred_volunteer || '',
    record.created_at,
    record.email_status,
    record.email_sent_at || '-',
    record.import_batch_id,
  ];
}

export function recordToDonationRow(record: EventRecord): (string | number)[] {
  return [
    record.id,
    record.order_id,
    record.code || '',
    record.payment_page_id || '',
    record.payment_page_title || '',
    record.payment_date || '',
    record.item_name,
    record.item_amount,
    record.item_payment_amount,
    record.total_payment_amount,
    record.currency,
    record.payment_status,
    record.payment_id || '',
    record.email || '',
    record.phone || '',
    record.name || '',
    record.pan_number || '',
    record.divisions || '',
    record.l2 || '',
    record.referred_volunteer || '',
    record.created_at,
    record.email_status,
    record.email_sent_at || '-',
    record.import_batch_id,
  ];
}

export function batchToLogRow(batch: ImportBatch): (string | number)[] {
  return [
    batch.id,
    batch.file_name,
    batch.created_at,
    batch.total_rows,
    batch.captured_rows,
    batch.pass_transactions,
    batch.total_passes,
    batch.donation_transactions,
    batch.total_donation_amount,
    batch.duplicates_skipped,
    batch.errors_count,
    batch.status,
  ];
}

export async function syncToGoogleSheets(
  batch: ImportBatch,
  records: EventRecord[]
): Promise<{ success: boolean; message: string; rowsSynced: number }> {
  const settings = getSettings();
  const spreadsheetId = settings.googleSpreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;
  const serviceAccountEmail = settings.googleServiceAccountEmail || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (settings.googlePrivateKey || process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  const passRecords = records.filter((r) => r.record_type === 'PASS');
  const donationRecords = records.filter((r) => r.record_type === 'DONATION');

  // Check if live mode is enabled and credentials are valid
  if (
    settings.googleSheetsMode === 'live' &&
    spreadsheetId &&
    serviceAccountEmail &&
    privateKey
  ) {
    try {
      const auth = new google.auth.JWT({
        email: serviceAccountEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const sheets = google.sheets({ version: 'v4', auth });

      // Append Passes
      if (passRecords.length > 0) {
        const passRows = passRecords.map(recordToPassRow);
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: 'PASS!A1',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: passRows },
        });
      }

      // Append Donations
      if (donationRecords.length > 0) {
        const donationRows = donationRecords.map(recordToDonationRow);
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: 'DONATION!A1',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: donationRows },
        });
      }

      // Append Log
      const logRow = [batchToLogRow(batch)];
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'IMPORT LOG!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: logRow },
      });

      return {
        success: true,
        message: `Successfully synced ${records.length} records to live Google Sheets tabs (PASS & DONATION).`,
        rowsSynced: records.length,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Google Sheets live sync error:', msg);
      return {
        success: false,
        message: `Google Sheets API error: ${msg}. Fallback mode preserved database records.`,
        rowsSynced: 0,
      };
    }
  }

  // Emulated / Demo Mode
  return {
    success: true,
    message: `[Demo Mode] Simulated sync to Google Sheets tabs (PASS: ${passRecords.length} rows, DONATION: ${donationRecords.length} rows, IMPORT LOG: 1 row).`,
    rowsSynced: records.length,
  };
}

export async function testGoogleSheetsConnection(spreadsheetId: string, email: string, key: string): Promise<{ success: boolean; message: string; sheetNames?: string[] }> {
  try {
    const formattedKey = key.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT({
      email,
      key: formattedKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetTitles = (response.data.sheets || []).map((s) => s.properties?.title || '');
    return {
      success: true,
      message: `Successfully connected to spreadsheet "${response.data.properties?.title}"!`,
      sheetNames: sheetTitles,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Google Sheets connection failed: ${msg}` };
  }
}
