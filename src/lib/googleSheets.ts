import { EventRecord, ImportBatch } from './types';

export function extractSpreadsheetId(urlOrId?: string): string {
  return '';
}

export async function syncToGoogleSheets(
  batch: ImportBatch,
  records: EventRecord[]
): Promise<{ success: boolean; message: string; rowsSynced: number }> {
  return {
    success: true,
    message: 'Google Sheets sync disabled.',
    rowsSynced: records.length,
  };
}

export async function testGoogleSheetsConnection(rawSpreadsheetId: string, email: string, key: string): Promise<{ success: boolean; message: string; sheetNames?: string[] }> {
  return {
    success: true,
    message: 'Google Sheets integration disabled.',
  };
}
