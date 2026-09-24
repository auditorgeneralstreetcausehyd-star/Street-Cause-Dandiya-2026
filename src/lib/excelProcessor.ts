import * as XLSX from 'xlsx';
import {
  createImportBatch,
  getExistingOrderIds,
  getSettings,
  insertEventRecords,
  updateImportBatch,
} from './db';
import { syncToGoogleSheets } from './googleSheets';
import {
  EventRecord,
  ImportBatch,
  PreImportAnalysis,
  RecordType,
} from './types';

// Helper to normalize header keys
function normalizeKey(key: string): string {
  return key.toLowerCase().trim().replace(/[\s_-]+/g, ' ');
}

// Map row fields from arbitrary variation to standard schema
function extractField(row: Record<string, unknown>, targets: string[]): string {
  const keys = Object.keys(row);
  for (const t of targets) {
    const normTarget = normalizeKey(t);
    const foundKey = keys.find((k) => normalizeKey(k) === normTarget);
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
      return String(row[foundKey]).trim();
    }
  }
  return '';
}

export function parseRawRows(buffer: Buffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
}

// Stage 1: Analyze Excel File
export async function analyzeExcelBuffer(
  buffer: Buffer,
  fileName: string,
  eventId: string = 'garba_groove'
): Promise<PreImportAnalysis> {
  const rows = parseRawRows(buffer);
  const settings = getSettings();
  const existingOrderIds = await getExistingOrderIds();

  const eventName = eventId === 'navratri_utsav' ? 'Navratri Utsav 2026' : 'Garba Groove 2026';

  const acceptedStatuses = new Set(
    (settings.acceptedPaymentStatuses || ['captured', 'paid', 'success', 'successful', 'completed']).map((s) =>
      s.toLowerCase().trim()
    )
  );

  const passKeywords = (settings.passKeywords || ['pass', 'ticket', 'entry', 'single', 'couple', 'vip', 'garba', 'dandiya']).map(
    (k) => k.toLowerCase().trim()
  );

  const donationKeywords = (settings.donationKeywords || ['donation', 'donate', 'daan', 'seva', 'contribut', 'sponsorship']).map(
    (k) => k.toLowerCase().trim()
  );

  let capturedRows = 0;
  let ignoredRows = 0;
  let failedStatusRows = 0;
  let emptyStatusRows = 0;
  let passTransactions = 0;
  let totalPasses = 0;
  let donationTransactions = 0;
  let totalDonationAmount = 0;
  let unclassifiedRowsCount = 0;

  const warnings: string[] = [];
  const fileOrderIds = new Set<string>();
  let duplicatesInFile = 0;
  let existingDuplicatesCount = 0;

  const previewPasses: Partial<EventRecord>[] = [];
  const previewDonations: Partial<EventRecord>[] = [];
  const previewDuplicates: { order_id: string; name?: string; item_name?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const status = extractField(raw, ['payment status', 'status', 'payment_status']).toLowerCase();
    const orderId = extractField(raw, ['order_id', 'order id', 'orderid']);
    const itemName = extractField(raw, ['item name', 'item_name', 'item', 'description', 'title']);
    const rawQty = extractField(raw, ['item quantity', 'quantity', 'item_quantity', 'qty', 'no of passes', 'number of passes']);
    const rawItemAmt = extractField(raw, ['item payment amount', 'item_payment_amount', 'item amount', 'amount', 'item_amount']);
    const rawTotalAmt = extractField(raw, ['total payment amount', 'total_payment_amount', 'total amount']);
    const name = extractField(raw, ['name', 'buyer name', 'customer name']);
    const email = extractField(raw, ['email_id', 'email', 'email address']);
    const divisions = extractField(raw, ['divisions', 'division']);

    // Check if status is captured
    if (!status) {
      emptyStatusRows++;
      ignoredRows++;
      continue;
    }

    if (status === 'failed' || status === 'refunded' || status === 'pending' || status === 'created') {
      failedStatusRows++;
      ignoredRows++;
      continue;
    }

    if (!acceptedStatuses.has(status)) {
      warnings.push(`Row ${i + 2}: Unknown payment status "${status}". Ignored.`);
      ignoredRows++;
      continue;
    }

    // Row is captured
    capturedRows++;

    if (!orderId) {
      warnings.push(`Row ${i + 2}: Captured payment missing order_id. Cannot safely deduplicate.`);
      unclassifiedRowsCount++;
      continue;
    }

    // Duplicate Check
    let isDup = false;
    if (fileOrderIds.has(orderId)) {
      duplicatesInFile++;
      isDup = true;
    } else {
      fileOrderIds.add(orderId);
    }

    if (existingOrderIds.has(orderId)) {
      existingDuplicatesCount++;
      isDup = true;
    }

    if (isDup) {
      if (previewDuplicates.length < 10) {
        previewDuplicates.push({ order_id: orderId, name, item_name: itemName });
      }
      continue;
    }

    // Classify
    const lowerItem = itemName.toLowerCase();
    const isPass = passKeywords.some((k) => lowerItem.includes(k));
    const isDonation = donationKeywords.some((k) => lowerItem.includes(k));

    const qty = parseInt(rawQty, 10);
    const validQty = isNaN(qty) || qty <= 0 ? 1 : qty;
    if (isPass && (isNaN(qty) || qty <= 0)) {
      warnings.push(`Row ${i + 2} (${orderId}): Pass quantity missing or 0. Defaulted to 1.`);
    }

    const itemAmt = parseFloat(rawItemAmt) || parseFloat(rawTotalAmt) || 0;

    if (isPass) {
      passTransactions++;
      totalPasses += validQty;
      if (previewPasses.length < 5) {
        previewPasses.push({
          order_id: orderId,
          name,
          email,
          item_name: itemName,
          item_quantity: validQty,
          item_payment_amount: itemAmt,
          divisions,
        });
      }
    } else if (isDonation) {
      donationTransactions++;
      totalDonationAmount += itemAmt;
      if (previewDonations.length < 5) {
        previewDonations.push({
          order_id: orderId,
          name,
          email,
          item_name: itemName,
          item_quantity: validQty,
          item_payment_amount: itemAmt,
          divisions,
        });
      }
    } else {
      unclassifiedRowsCount++;
      warnings.push(`Row ${i + 2} (${orderId}): Item name "${itemName}" could not be classified. Review required.`);
    }
  }

  const totalDuplicatesToSkip = duplicatesInFile + existingDuplicatesCount;
  const newRecordsToImport = passTransactions + donationTransactions;

  return {
    fileName,
    fileSizeBytes: buffer.length,
    eventId,
    eventName,
    totalRows: rows.length,
    capturedRows,
    ignoredRows,
    failedStatusRows,
    emptyStatusRows,
    passTransactions,
    totalPasses,
    donationTransactions,
    totalDonationAmount,
    duplicatesInFile,
    existingDuplicatesCount,
    totalDuplicatesToSkip,
    newRecordsToImport,
    unclassifiedRowsCount,
    warnings: warnings.slice(0, 15), // Top 15 warnings
    previewPasses,
    previewDonations,
    previewDuplicates,
  };
}

// Stage 2: Transactional Import Execution
export async function processAndImportExcel(
  buffer: Buffer,
  fileName: string,
  eventId: string = 'garba_groove'
): Promise<{ batch: ImportBatch; syncResult: { success: boolean; message: string; rowsSynced: number } }> {
  const analysis = await analyzeExcelBuffer(buffer, fileName, eventId);
  const rows = parseRawRows(buffer);
  const settings = getSettings();
  const existingOrderIds = await getExistingOrderIds();

  const eventName = eventId === 'navratri_utsav' ? 'Navratri Utsav 2026' : 'Garba Groove 2026';

  const acceptedStatuses = new Set(
    (settings.acceptedPaymentStatuses || ['captured', 'paid', 'success', 'successful', 'completed']).map((s) =>
      s.toLowerCase().trim()
    )
  );

  const passKeywords = (settings.passKeywords || ['pass', 'ticket', 'entry', 'single', 'couple', 'vip', 'garba', 'dandiya']).map(
    (k) => k.toLowerCase().trim()
  );

  const donationKeywords = (settings.donationKeywords || ['donation', 'donate', 'daan', 'seva', 'contribut', 'sponsorship']).map(
    (k) => k.toLowerCase().trim()
  );

  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  // Create batch with status PROCESSING
  const initialBatch: ImportBatch = {
    id: batchId,
    file_name: fileName,
    file_size: buffer.length,
    event_id: eventId,
    event_name: eventName,
    total_rows: analysis.totalRows,
    captured_rows: analysis.capturedRows,
    pass_transactions: analysis.passTransactions,
    total_passes: analysis.totalPasses,
    donation_transactions: analysis.donationTransactions,
    total_donation_amount: analysis.totalDonationAmount,
    duplicates_skipped: analysis.totalDuplicatesToSkip,
    errors_count: analysis.unclassifiedRowsCount,
    status: 'PROCESSING',
    created_at: now,
  };

  await createImportBatch(initialBatch);

  const recordsToInsert: EventRecord[] = [];
  const seenInBatch = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const status = extractField(raw, ['payment status', 'status', 'payment_status']).toLowerCase();
    const orderId = extractField(raw, ['order_id', 'order id', 'orderid']);
    const itemName = extractField(raw, ['item name', 'item_name', 'item', 'description', 'title']);
    const rawQty = extractField(raw, ['item quantity', 'quantity', 'item_quantity', 'qty', 'no of passes']);
    const rawItemAmt = extractField(raw, ['item payment amount', 'item_payment_amount', 'item amount', 'amount', 'item_amount']);
    const rawTotalAmt = extractField(raw, ['total payment amount', 'total_payment_amount', 'total amount']);

    if (!status || !acceptedStatuses.has(status)) continue;
    if (!orderId) continue;

    // Duplicate prevention
    if (existingOrderIds.has(orderId) || seenInBatch.has(orderId)) {
      continue;
    }
    seenInBatch.add(orderId);

    const lowerItem = itemName.toLowerCase();
    const isPass = passKeywords.some((k) => lowerItem.includes(k));
    const isDonation = donationKeywords.some((k) => lowerItem.includes(k));

    if (!isPass && !isDonation) {
      continue; // Unclassified items skipped
    }

    const qty = parseInt(rawQty, 10);
    const validQty = isNaN(qty) || qty <= 0 ? 1 : qty;
    const itemAmt = parseFloat(rawItemAmt) || parseFloat(rawTotalAmt) || 0;
    const totalAmt = parseFloat(rawTotalAmt) || itemAmt * validQty;

    const recordType: RecordType = isPass ? 'PASS' : 'DONATION';

    const record: EventRecord = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      order_id: orderId,
      event_id: eventId,
      event_name: eventName,
      record_type: recordType,
      payment_page_id: extractField(raw, ['payment page id', 'payment_page_id']),
      payment_page_title: extractField(raw, ['payment page title', 'payment_page_title']),
      payment_date: extractField(raw, ['payment date', 'payment_date', 'date']),
      item_name: itemName,
      item_amount: parseFloat(extractField(raw, ['item amount', 'item_amount'])) || itemAmt,
      item_quantity: validQty,
      item_payment_amount: itemAmt,
      total_payment_amount: totalAmt,
      currency: extractField(raw, ['currency']) || 'INR',
      payment_status: status,
      payment_id: extractField(raw, ['payment id', 'payment_id']),
      email: extractField(raw, ['email_id', 'email', 'email address']),
      phone: extractField(raw, ['phone', 'mobile', 'contact']),
      name: extractField(raw, ['name', 'buyer name', 'customer name']),
      pan_number: extractField(raw, ['pan_number', 'pan', 'pan number']),
      divisions: extractField(raw, ['divisions', 'division']),
      l2: extractField(raw, ['l2']),
      referred_volunteer: extractField(raw, ['reffered_volunteer', 'referred_volunteer', 'volunteer', 'ref volunteer']),
      code: extractField(raw, ['code']),
      source_file: fileName,
      import_batch_id: batchId,
      email_status: 'Pending',
      email_sent_at: null,
      created_at: now,
    };

    recordsToInsert.push(record);
  }

  // Insert into Primary Database (Supabase / Local)
  await insertEventRecords(recordsToInsert);

  // Update batch status to SYNCING
  await updateImportBatch(batchId, { status: 'SYNCING' });

  // Sync to Google Sheets (Downstream Zapier layer)
  const syncResult = await syncToGoogleSheets(initialBatch, recordsToInsert);

  // Mark Batch as COMPLETED
  const finalStatus = syncResult.success ? 'COMPLETED' : 'COMPLETED'; // Database is preserved even if sheets had error
  await updateImportBatch(batchId, {
    status: finalStatus,
    error_message: syncResult.success ? null : syncResult.message,
  });

  const completedBatch: ImportBatch = {
    ...initialBatch,
    status: finalStatus,
    error_message: syncResult.success ? null : syncResult.message,
  };

  return { batch: completedBatch, syncResult };
}
