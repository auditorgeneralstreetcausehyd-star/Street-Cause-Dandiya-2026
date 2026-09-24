export type RecordType = 'PASS' | 'DONATION';

export type BatchStatus = 'PROCESSING' | 'VALIDATED' | 'SYNCING' | 'COMPLETED' | 'FAILED';

export type EmailStatus = 'Pending' | 'Sent' | 'Failed';

export type EventId = 'garba_groove' | 'navratri_utsav' | 'all';

export interface EventInfo {
  id: 'garba_groove' | 'navratri_utsav';
  name: string;
  tagline: string;
  themeColor: string;
  badge: string;
  date: string;
  venue: string;
}

export interface DayDivisionStat {
  division: string;
  passTransactions: number;
  totalPasses: number;
  donationTransactions: number;
  totalDonationAmount: number;
  totalRevenue: number;
  totalTransactions: number;
}

export interface DayWiseStat {
  date: string;         // 'YYYY-MM-DD'
  displayDate: string;  // e.g. '20 Sep 2026'
  passTransactions: number;
  totalPasses: number;
  donationTransactions: number;
  totalDonationAmount: number;
  totalRevenue: number;
  totalTransactions: number;
  divisionStats: DayDivisionStat[];
}

export interface VolunteerStat {
  name: string;
  l2: string;
  division: string;
  passes: number;
  passTransactions: number;
  donations: number;
  donationTransactions: number;
  totalTransactions: number;
}

export interface DivisionStats {
  division: string;
  passTransactions: number;
  totalPasses: number;
  donationTransactions: number;
  totalDonationAmount: number;
  totalRevenue: number;
  totalTransactions: number;
  volunteersCount: number;
  topVolunteers: { name: string; passes: number; donations: number }[];
  allVolunteers: VolunteerStat[];
  dayWiseTrend?: { date: string; displayDate: string; passes: number; donations: number }[];
}

export interface ImportBatch {
  id: string;
  file_name: string;
  file_size: number;
  event_id?: string;
  event_name?: string;
  total_rows: number;
  captured_rows: number;
  pass_transactions: number;
  total_passes: number;
  donation_transactions: number;
  total_donation_amount: number;
  duplicates_skipped: number;
  errors_count: number;
  status: BatchStatus;
  error_message?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface EventRecord {
  id: string;
  order_id: string;
  event_id?: string;
  event_name?: string;
  record_type: RecordType;
  payment_page_id?: string;
  payment_page_title?: string;
  payment_date?: string;
  item_name: string;
  item_amount: number;
  item_quantity: number;
  item_payment_amount: number;
  total_payment_amount: number;
  currency: string;
  payment_status: string;
  payment_id?: string;
  email?: string;
  phone?: string;
  name?: string;
  pan_number?: string;
  divisions?: string;
  l2?: string;
  referred_volunteer?: string;
  code?: string;
  source_file: string;
  import_batch_id: string;
  email_status: EmailStatus;
  email_sent_at?: string | null;
  created_at: string;
}

export interface ImportError {
  id: string;
  import_batch_id: string;
  row_number: number;
  raw_data: Record<string, unknown>;
  reason: string;
  created_at: string;
}

export interface DashboardStats {
  totalCapturedPasses: number; // SUM(item_quantity) for PASS
  passTransactions: number;    // COUNT(PASS)
  capturedDonations: number;   // COUNT(DONATION)
  totalDonationAmount: number; // SUM(item_payment_amount) for DONATION
  totalCapturedRows: number;
  totalImportedBatches: number;
  latestImport?: ImportBatch | null;
  divisionStats?: DivisionStats[];
  dayWiseStats?: DayWiseStat[];
}

export interface SystemSettings {
  storageMode: 'auto' | 'supabase' | 'local';
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceKey?: string;
  googleSpreadsheetId?: string;
  googleServiceAccountEmail?: string;
  googlePrivateKey?: string;
  googleSheetsMode: 'mock' | 'live';
  acceptedPaymentStatuses: string[];
  passKeywords: string[];
  donationKeywords: string[];
}

export interface PreImportAnalysis {
  fileName: string;
  fileSizeBytes: number;
  eventId?: string;
  eventName?: string;
  totalRows: number;
  capturedRows: number;
  ignoredRows: number;
  failedStatusRows: number;
  emptyStatusRows: number;
  passTransactions: number;
  totalPasses: number;
  donationTransactions: number;
  totalDonationAmount: number;
  duplicatesInFile: number;
  existingDuplicatesCount: number;
  totalDuplicatesToSkip: number;
  newRecordsToImport: number;
  unclassifiedRowsCount: number;
  warnings: string[];
  previewPasses: Partial<EventRecord>[];
  previewDonations: Partial<EventRecord>[];
  previewDuplicates: { order_id: string; name?: string; item_name?: string }[];
}
