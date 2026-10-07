import * as XLSX from 'xlsx';
import {
  createImportBatch,
  getExistingOrderIds,
  getExistingRecordKeys,
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
      const val = row[foundKey];
      if (val instanceof Date) {
        // Format to DD/MM/YYYY HH:mm:ss
        const day = String(val.getDate()).padStart(2, '0');
        const month = String(val.getMonth() + 1).padStart(2, '0');
        const year = val.getFullYear();
        const hours = String(val.getHours()).padStart(2, '0');
        const minutes = String(val.getMinutes()).padStart(2, '0');
        const seconds = String(val.getSeconds()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
      }
      return String(val).trim();
    }
  }
  return '';
}

export function parseRawRows(buffer: Buffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
}

// Helper: Event Classifier from Payment Page Title (Column B: "SC HYD GARBA GROOVE" vs "SC HYD NAVRATRI UTSAV")
export function classifyEventFromTitle(paymentPageTitle: string): 'garba_groove' | 'navratri_utsav' | null {
  if (!paymentPageTitle) return null;
  const normalized = paymentPageTitle.toLowerCase().trim().replace(/[\s_-]+/g, ' ');
  if (normalized.includes('garba groove') || normalized.includes('garba')) {
    return 'garba_groove';
  }
  if (normalized.includes('navratri utsav') || normalized.includes('navratri') || normalized.includes('utsav') || normalized.includes('nirvana')) {
    return 'navratri_utsav';
  }
  return null;
}

// Stage 1: Analyze Excel File
export async function analyzeExcelBuffer(
  buffer: Buffer,
  fileName: string,
  targetEventId: string = 'garba_groove'
): Promise<PreImportAnalysis> {
  const rows = parseRawRows(buffer);
  const settings = getSettings();
  const existingRecordKeys = await getExistingRecordKeys();

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

  // New vs Existing breakdowns
  let newPasses = 0;
  let newPassTransactions = 0;
  let existingPasses = 0;
  let existingPassTransactions = 0;
  let newDonationAmount = 0;
  let newDonationTransactions = 0;
  let existingDonationAmount = 0;
  let existingDonationTransactions = 0;

  const warnings: string[] = [];
  const fileRecordKeys = new Set<string>();
  let duplicatesInFile = 0;
  let existingDuplicatesCount = 0;
  let totalDuplicatesToSkip = 0;

  const detectedEvents = new Set<'garba_groove' | 'navratri_utsav'>();

  const previewPasses: Partial<EventRecord>[] = [];
  const previewDonations: Partial<EventRecord>[] = [];
  const previewDuplicates: { order_id: string; name?: string; item_name?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const status = extractField(raw, ['payment status', 'status', 'payment_status']).toLowerCase();
    const orderId = extractField(raw, ['order_id', 'order id', 'orderid']);
    const paymentPageTitle = extractField(raw, ['payment page title', 'payment_page_title', 'title']);
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

    // Validate Event Classification from Column B (Payment Page Title)
    const detectedEvent = classifyEventFromTitle(paymentPageTitle);
    if (detectedEvent) {
      detectedEvents.add(detectedEvent);
    } else if (paymentPageTitle) {
      warnings.push(`Row ${i + 2} (${orderId}): Payment Page Title "${paymentPageTitle}" could not be auto-classified into an event.`);
    }

    if (targetEventId !== 'all' && detectedEvent && detectedEvent !== targetEventId) {
      warnings.push(`Row ${i + 2} (${orderId}): Payment Page Title indicates event "${detectedEvent === 'navratri_utsav' ? 'Navratri Nirvana' : 'Garba Groove'}", but target event is "${targetEventId}".`);
    }

    // Classify Pass vs Donation
    const lowerItem = itemName.toLowerCase();
    const isPass = passKeywords.some((k) => lowerItem.includes(k));
    const isDonation = donationKeywords.some((k) => lowerItem.includes(k));

    if (!isPass && !isDonation) {
      unclassifiedRowsCount++;
      warnings.push(`Row ${i + 2} (${orderId}): Item name "${itemName}" could not be classified.`);
      continue;
    }

    const recordType: RecordType = isPass ? 'PASS' : 'DONATION';
    const rowDetectedEvent = detectedEvent || (targetEventId === 'all' ? 'garba_groove' : targetEventId);

    const qty = parseInt(rawQty, 10);
    const validQty = isNaN(qty) || qty <= 0 ? 1 : qty;
    if (isPass && (isNaN(qty) || qty <= 0)) {
      warnings.push(`Row ${i + 2} (${orderId}): Pass quantity missing or 0. Defaulted to 1.`);
    }

    // total_payment_amount is the whole order (a pass + donation order repeats it on both rows),
    // so per-row amounts and totals use the item payment amount.
    const totalAmt = parseFloat(rawTotalAmt) || parseFloat(rawItemAmt) || 0;
    const itemAmt = parseFloat(rawItemAmt) || totalAmt;

    // Duplicate key format matching db.ts: eventId__recordType__orderId
    const recordKey = `${rowDetectedEvent}__${recordType}__${orderId}`;
    const isExistingInDb = existingRecordKeys.has(recordKey);
    const isDuplicateInFile = fileRecordKeys.has(recordKey);
    const isDuplicate = isExistingInDb || isDuplicateInFile;

    if (isDuplicate) {
      totalDuplicatesToSkip++;
      if (isExistingInDb) {
        existingDuplicatesCount++;
      } else {
        duplicatesInFile++;
      }
      if (previewDuplicates.length < 5) {
        previewDuplicates.push({ order_id: orderId, name, item_name: itemName });
      }
    } else {
      fileRecordKeys.add(recordKey);
    }

    if (isPass) {
      passTransactions++;
      totalPasses += validQty;

      if (!isDuplicate) {
        newPassTransactions++;
        newPasses += validQty;
        if (previewPasses.length < 5) {
          previewPasses.push({
            order_id: orderId,
            code: orderId,
            name,
            email,
            item_name: itemName,
            item_quantity: validQty,
            item_payment_amount: itemAmt,
            divisions,
          });
        }
      } else {
        existingPassTransactions++;
        existingPasses += validQty;
      }
    } else if (isDonation) {
      donationTransactions++;
      totalDonationAmount += itemAmt;

      if (!isDuplicate) {
        newDonationTransactions++;
        newDonationAmount += itemAmt;
        if (previewDonations.length < 5) {
          previewDonations.push({
            order_id: orderId,
            code: orderId,
            name,
            email,
            item_name: itemName,
            item_quantity: validQty,
            item_payment_amount: itemAmt,
            divisions,
          });
        }
      } else {
        existingDonationTransactions++;
        existingDonationAmount += itemAmt;
      }
    }
  }

  // Determine final batch event ID
  let finalEventId = targetEventId;
  if (detectedEvents.size === 1) {
    finalEventId = Array.from(detectedEvents)[0];
  } else if (detectedEvents.size > 1 && targetEventId !== 'all') {
    warnings.unshift(`WARNING: Uploaded file contains mixed records for both Garba Groove and Navratri Nirvana. Records will be assigned per row.`);
  }

  const finalEventName = finalEventId === 'navratri_utsav' ? 'Navratri Nirvana 2026' : 'Garba Groove 2026';
  const newRecordsToImport = newPassTransactions + newDonationTransactions;

  return {
    fileName,
    fileSizeBytes: buffer.length,
    eventId: finalEventId,
    eventName: finalEventName,
    totalRows: rows.length,
    capturedRows,
    ignoredRows,
    failedStatusRows,
    emptyStatusRows,
    passTransactions,
    totalPasses,
    donationTransactions,
    totalDonationAmount,
    newRowsCount: newRecordsToImport,
    duplicateRowsCount: totalDuplicatesToSkip,
    newPasses,
    newPassTransactions,
    existingPasses,
    existingPassTransactions,
    newDonationAmount,
    newDonationTransactions,
    existingDonationAmount,
    existingDonationTransactions,
    duplicatesInFile,
    existingDuplicatesCount,
    totalDuplicatesToSkip,
    newRecordsToImport,
    unclassifiedRowsCount,
    warnings: warnings.slice(0, 15),
    previewPasses,
    previewDonations,
    previewDuplicates,
  };
}

// Stage 2: Transactional Import Execution
export async function processAndImportExcel(
  buffer: Buffer,
  fileName: string,
  targetEventId: string = 'garba_groove'
): Promise<{ batch: ImportBatch; syncResult: { success: boolean; message: string; rowsSynced: number } }> {
  const analysis = await analyzeExcelBuffer(buffer, fileName, targetEventId);
  const rows = parseRawRows(buffer);
  const settings = getSettings();
  const existingRecordKeys = await getExistingRecordKeys();

  const batchEventId = analysis.eventId || targetEventId;
  const batchEventName = batchEventId === 'navratri_utsav' ? 'Navratri Nirvana 2026' : 'Garba Groove 2026';

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
    event_id: batchEventId,
    event_name: batchEventName,
    total_rows: analysis.totalRows,
    captured_rows: analysis.capturedRows,
    pass_transactions: analysis.newPassTransactions,
    total_passes: analysis.newPasses,
    donation_transactions: analysis.newDonationTransactions,
    total_donation_amount: analysis.newDonationAmount,
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
    const paymentPageTitle = extractField(raw, ['payment page title', 'payment_page_title', 'title']);
    const itemName = extractField(raw, ['item name', 'item_name', 'item', 'description', 'title']);
    const rawQty = extractField(raw, ['item quantity', 'quantity', 'item_quantity', 'qty', 'no of passes']);
    const rawItemAmt = extractField(raw, ['item payment amount', 'item_payment_amount', 'item amount', 'amount', 'item_amount']);
    const rawTotalAmt = extractField(raw, ['total payment amount', 'total_payment_amount', 'total amount']);

    if (!status || !acceptedStatuses.has(status)) continue;
    if (!orderId) continue;

    const lowerItem = itemName.toLowerCase();
    const isPass = passKeywords.some((k) => lowerItem.includes(k));
    const isDonation = donationKeywords.some((k) => lowerItem.includes(k));

    if (!isPass && !isDonation) {
      continue;
    }

    const recordType: RecordType = isPass ? 'PASS' : 'DONATION';

    const qty = parseInt(rawQty, 10);
    const validQty = isNaN(qty) || qty <= 0 ? 1 : qty;
    const totalAmt = parseFloat(rawTotalAmt) || parseFloat(rawItemAmt) || 0;
    const itemAmt = parseFloat(rawItemAmt) || totalAmt;

    // Per-row event classification validation
    const rowDetectedEvent = classifyEventFromTitle(paymentPageTitle) || batchEventId;
    const rowEventName = rowDetectedEvent === 'navratri_utsav' ? 'Navratri Nirvana 2026' : 'Garba Groove 2026';

    const recordKey = `${rowDetectedEvent}__${recordType}__${orderId}`;
    if (existingRecordKeys.has(recordKey) || seenInBatch.has(recordKey)) {
      // Duplicate skip
      continue;
    }
    seenInBatch.add(recordKey);

    const record: EventRecord = {
      id: `rec_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 8)}`,
      order_id: orderId,
      code: orderId, // Strictly enforce code === order_id
      event_id: rowDetectedEvent,
      event_name: rowEventName,
      record_type: recordType,
      payment_page_id: extractField(raw, ['payment page id', 'payment_page_id']),
      payment_page_title: paymentPageTitle,
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
      source_file: fileName,
      import_batch_id: batchId,
      email_status: 'Pending',
      email_sent_at: null,
      attendance_status: 'PENDING',
      checked_in_at: null,
      created_at: now,
    };

    recordsToInsert.push(record);
  }

  // Insert into Primary Database (Supabase / Local)
  if (recordsToInsert.length > 0) {
    await insertEventRecords(recordsToInsert);
  }

  // Mark Batch as COMPLETED
  await updateImportBatch(batchId, {
    status: 'COMPLETED',
    error_message: null,
  });

  const completedBatch: ImportBatch = {
    ...initialBatch,
    status: 'COMPLETED',
    error_message: null,
  };

  const syncResult = {
    success: true,
    message: `Successfully imported ${recordsToInsert.length} new records (${analysis.totalDuplicatesToSkip} duplicates skipped) for ${batchEventName}.`,
    rowsSynced: recordsToInsert.length,
  };

  return { batch: completedBatch, syncResult };
}

