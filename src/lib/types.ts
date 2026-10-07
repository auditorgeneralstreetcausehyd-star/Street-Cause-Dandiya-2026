export type RecordType = 'PASS' | 'DONATION';

export type BatchStatus = 'PROCESSING' | 'VALIDATED' | 'SYNCING' | 'COMPLETED' | 'FAILED';

export type EmailStatus = 'Pending' | 'Sending' | 'Sent' | 'Failed';

// DEFERRED = parked because every sender account hit its daily limit; the pass stays Pending for a later send
export type EmailJobStatus = 'QUEUED' | 'PROCESSING' | 'SENT' | 'RETRYING' | 'FAILED' | 'DEFERRED';

export interface EmailBatch {
  batch_id: string;
  event_id: string;
  requested_by?: string;
  total: number;
  queued: number;
  processing: number;
  sent: number;
  retrying: number;
  failed: number;
  created_at: string;
  completed_at?: string | null;
}

export interface EmailDispatchLog {
  id: string;
  batch_id: string;
  order_id: string;
  event_id: string;
  recipient_email: string;
  status: EmailJobStatus;
  attempt_count: number;
  smtp_message_id?: string | null;
  smtp_account?: string | null; // Gmail account that sent it, used for per-account daily quota
  smtp_code?: number | string | null;
  error_message?: string | null;
  next_retry_at?: string | null;
  created_at: string;
  updated_at: string;
  sent_at?: string | null;
}

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
  totalPassAmount?: number;
  donationTransactions: number;
  totalDonationAmount: number;
  totalRevenue: number;
  totalTransactions: number;
}

export interface HourlyStat {
  hour: number;          // 0 - 23
  hourLabel: string;     // '02 PM' or '02:00 PM'
  hourDisplay: string;   // '02:00 PM - 03:00 PM'
  isoHour: string;       // '14'
  passTransactions: number;
  totalPasses: number;
  totalPassAmount?: number;
  donationTransactions: number;
  totalDonationAmount: number;
  totalRevenue: number;
  totalTransactions: number;
  divisionStats: DayDivisionStat[];
}

export interface DayWiseStat {
  date: string;         // 'YYYY-MM-DD'
  displayDate: string;  // e.g. '20 Sep 2026'
  passTransactions: number;
  totalPasses: number;
  totalPassAmount?: number;
  donationTransactions: number;
  totalDonationAmount: number;
  totalRevenue: number;
  totalTransactions: number;
  divisionStats: DayDivisionStat[];
  hourlyStats?: HourlyStat[];
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
  totalPassAmount?: number;
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
  email_last_attempt_at?: string | null;
  email_error?: string | null;
  email_sent_from?: string | null; // derived from email_dispatch_logs, not a stored column
  attendance_status?: 'PENDING' | 'PRESENT' | 'CANCELLED';
  checked_in_at?: string | null;
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
  totalCapturedPassAmount?: number; // SUM(payment_amount) for PASS
  passTransactions: number;    // COUNT(PASS)
  capturedDonations: number;   // COUNT(DONATION)
  totalDonationAmount: number; // SUM(item_payment_amount) for DONATION
  totalRevenue?: number;       // totalCapturedPassAmount + totalDonationAmount
  totalCapturedRows: number;
  totalImportedBatches: number;
  latestImport?: ImportBatch | null;
  divisionStats?: DivisionStats[];
  dayWiseStats?: DayWiseStat[];
  hourlyStats?: HourlyStat[];
}

export interface SystemSettings {
  storageMode: 'auto' | 'supabase' | 'local';
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceKey?: string;
  googleSpreadsheetId?: string;
  garbaGrooveSpreadsheetId?: string;
  navratriUtsavSpreadsheetId?: string;
  garbaPassBgUrl?: string;
  navratriPassBgUrl?: string;
  googleServiceAccountEmail?: string;
  googlePrivateKey?: string;
  googleSheetsMode: 'mock' | 'live';
  acceptedPaymentStatuses: string[];
  passKeywords: string[];
  donationKeywords: string[];
}

export interface EventConfig {
  id: 'garba_groove' | 'navratri_utsav';
  name: string;
  shortName: string;
  tagline: string;
  date: string;
  venue: string;
  passBgUrl: string;
  keywords: string[];
}

export const EVENT_CONFIGS: Record<'garba_groove' | 'navratri_utsav', EventConfig> = {
  garba_groove: {
    id: 'garba_groove',
    name: 'Garba Groove 2026',
    shortName: 'Garba Groove',
    tagline: 'Presented by Street Cause Hyderabad',
    date: '10 Oct 2026',
    venue: 'Telangana Gardens, New Bowenpally',
    passBgUrl: 'https://res.cloudinary.com/ygf4cf8x/image/upload/v1791352492/Garba_Groove_Bg.png',
    keywords: ['garba', 'groove'],
  },
  navratri_utsav: {
    id: 'navratri_utsav',
    name: 'Navratri Utsav 2026',
    shortName: 'Navratri Utsav',
    tagline: 'Presented by Street Cause Hyderabad',
    date: '11 Oct 2026',
    venue: 'Telangana Gardens, New Bowenpally',
    passBgUrl: 'https://res.cloudinary.com/ygf4cf8x/image/upload/v1791352481/Navratri_utsav_BG.png',
    keywords: ['navratri', 'utsav', 'nirvana'],
  },
};

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
  newRowsCount: number;
  duplicateRowsCount: number;
  newPasses: number;
  newPassTransactions: number;
  existingPasses: number;
  existingPassTransactions: number;
  newDonationAmount: number;
  newDonationTransactions: number;
  existingDonationAmount: number;
  existingDonationTransactions: number;
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

