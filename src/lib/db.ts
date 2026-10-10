import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  DashboardStats,
  DayDivisionStat,
  DayWiseStat,
  DivisionStats,
  EmailStatus,
  EventRecord,
  ImportBatch,
  ImportError,
  SystemSettings,
  VolunteerStat,
} from './types';

// Default system settings
const DEFAULT_SETTINGS: SystemSettings = {
  storageMode: 'auto',
  googleSheetsMode: 'mock',
  acceptedPaymentStatuses: ['captured', 'paid', 'success', 'successful', 'completed'],
  passKeywords: ['pass', 'ticket', 'entry', 'single', 'couple', 'vip', 'garba', 'dandiya'],
  donationKeywords: ['donation', 'donate', 'daan', 'seva', 'contribut', 'sponsorship', 'support'],
  garbaGrooveSpreadsheetId: '',
  navratriUtsavSpreadsheetId: '',
  garbaPassBgUrl: 'https://res.cloudinary.com/ygf4cf8x/image/upload/v1791352492/Garba_Groove_Bg.png',
  navratriPassBgUrl: 'https://res.cloudinary.com/ygf4cf8x/image/upload/v1791352481/Navratri_utsav_BG.png',
};

// Local database file path & fallback
const DATA_DIR = path.join(process.cwd(), 'data');
const LOCAL_DB_PATH = path.join(DATA_DIR, 'local_db.json');
const TMP_DB_PATH = path.join(os.tmpdir(), 'sc_dandiya_local_db.json');

interface LocalDatabase {
  batches: ImportBatch[];
  records: EventRecord[];
  errors: ImportError[];
  settings: SystemSettings;
  email_batches?: import('./types').EmailBatch[];
  email_dispatch_logs?: import('./types').EmailDispatchLog[];
}

let inMemoryDb: LocalDatabase | null = null;

function safeWriteFile(filePath: string, content: string): boolean {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

function getDbFilePath(): string {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    return LOCAL_DB_PATH;
  } catch {
    return TMP_DB_PATH;
  }
}

function readLocalDb(): LocalDatabase {
  if (inMemoryDb) {
    return inMemoryDb;
  }

  const initial: LocalDatabase = {
    batches: [],
    records: [],
    errors: [],
    settings: DEFAULT_SETTINGS,
    email_batches: [],
    email_dispatch_logs: [],
  };

  let db: LocalDatabase = initial;
  const pathsToTry = [LOCAL_DB_PATH, TMP_DB_PATH];

  for (const p of pathsToTry) {
    try {
      if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
        const content = fs.readFileSync(/*turbopackIgnore: true*/ p, 'utf-8');
        const parsed = JSON.parse(content);
        db = {
          batches: Array.isArray(parsed.batches) ? parsed.batches : [],
          records: Array.isArray(parsed.records) ? parsed.records : [],
          errors: Array.isArray(parsed.errors) ? parsed.errors : [],
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
          email_batches: Array.isArray(parsed.email_batches) ? parsed.email_batches : [],
          email_dispatch_logs: Array.isArray(parsed.email_dispatch_logs) ? parsed.email_dispatch_logs : [],
        };
        break;
      }
    } catch {
      // Continue to next fallback
    }
  }

  let modified = false;
  if (Array.isArray(db.batches)) {
    for (const b of db.batches) {
      if (!b.event_id) {
        b.event_id = 'garba_groove';
        b.event_name = 'Garba Groove 2026';
        modified = true;
      }
    }
  }
  if (Array.isArray(db.records)) {
    for (const r of db.records) {
      if (!r.event_id) {
        r.event_id = 'garba_groove';
        r.event_name = 'Garba Groove 2026';
        modified = true;
      }
    }
  }

  inMemoryDb = db;

  const targetPath = getDbFilePath();
  if (modified || !fs.existsSync(targetPath)) {
    if (!safeWriteFile(targetPath, JSON.stringify(db, null, 2))) {
      safeWriteFile(TMP_DB_PATH, JSON.stringify(db, null, 2));
    }
  }

  return inMemoryDb;
}

function writeLocalDb(data: LocalDatabase): void {
  inMemoryDb = data;
  const targetPath = getDbFilePath();
  const success = safeWriteFile(targetPath, JSON.stringify(data, null, 2));
  if (!success && targetPath !== TMP_DB_PATH) {
    safeWriteFile(TMP_DB_PATH, JSON.stringify(data, null, 2));
  }
}

// Get Supabase Client if configured
let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Server-only service role key. The anon key is denied by RLS (see supabase/security_hardening.sql).
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key || url.trim() === '' || key.trim() === '') {
    if (url && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !key) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not set; Supabase is disabled and the local JSON store is used instead.');
    }
    return null;
  }

  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(url, key, {
        auth: { persistSession: false },
      });
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e);
      return null;
    }
  }
  return supabaseInstance;
}

export function isUsingSupabase(): boolean {
  const client = getSupabaseClient();
  const db = readLocalDb();
  if (db.settings.storageMode === 'local') return false;
  return client !== null;
}

export async function testSupabaseConnection(overrideUrl?: string, overrideKey?: string): Promise<{ success: boolean; message: string }> {
  try {
    const url = overrideUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = overrideKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return { success: false, message: 'Supabase URL and Key are required.' };
    }
    const client = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await client.from('import_batches').select('id').limit(1);
    if (error) {
      return { success: false, message: `Connected to Supabase project, but query failed: ${error.message}. Have you run supabase/schema.sql?` };
    }
    return { success: true, message: `Successfully connected to Supabase! Found ${data?.length ?? 0} existing batches.` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Supabase connection error: ${msg}` };
  }
}

// Helper: Determine target table name for an event and record type
export function getRecordTableName(eventId?: string, recordType: 'PASS' | 'DONATION' = 'PASS'): string {
  if (eventId === 'navratri_utsav') {
    return recordType === 'DONATION' ? 'navratri_utsav_donations' : 'navratri_utsav_passes';
  }
  return recordType === 'DONATION' ? 'garba_groove_donations' : 'garba_groove_passes';
}

const ALL_RECORD_TABLES = [
  'garba_groove_passes',
  'garba_groove_donations',
  'navratri_utsav_passes',
  'navratri_utsav_donations',
] as const;

// Tables holding records for an event ('all'/undefined = both) and type (undefined = both)
function recordTablesFor(eventId?: string, type?: 'PASS' | 'DONATION'): string[] {
  const events = eventId === 'garba_groove' || eventId === 'navratri_utsav' ? [eventId] : ['garba_groove', 'navratri_utsav'];
  const types: ('PASS' | 'DONATION')[] = type ? [type] : ['PASS', 'DONATION'];
  return events.flatMap((ev) => types.map((t) => getRecordTableName(ev, t)));
}

const SEARCH_COLUMNS = ['order_id', 'name', 'email', 'phone', 'payment_id', 'divisions', 'referred_volunteer'];

// Characters with meaning in PostgREST filter syntax or LIKE patterns are dropped from user search input
function sanitizeSearchTerm(search?: string): string {
  return (search || '').replace(/[,()"'\\%*:]/g, ' ').replace(/\s+/g, ' ').trim();
}

type RecordSelectQuery = ReturnType<ReturnType<SupabaseClient['from']>['select']>;

// Like fetchAllFromSupabase, but with filters applied in the database, and errors thrown rather than truncating
async function fetchAllMatching(
  client: SupabaseClient,
  tableName: string,
  applyFilters: (query: RecordSelectQuery) => RecordSelectQuery
): Promise<EventRecord[]> {
  const all: EventRecord[] = [];
  const pageSize = 1000;
  for (let page = 0; ; page++) {
    const { data, error } = await applyFilters(client.from(tableName).select('*'))
      .order('id', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw new Error(`${tableName}: ${error.message}`);
    all.push(...((data || []) as EventRecord[]));
    if (!data || data.length < pageSize) break;
  }
  return all;
}

// Helper to fetch ALL rows from a Supabase table handling PostgREST 1000-row pagination limit
async function fetchAllFromSupabase<T = Record<string, unknown>>(
  client: SupabaseClient,
  tableName: string,
  selectFields: string = '*'
): Promise<T[]> {
  const all: T[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await client
      .from(tableName)
      .select(selectFields)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    page++;
  }
  return all;
}

// Check existing order_ids strictly scoped by event and record type (PASS or DONATION) across each of the 4 tables.
// Table 1: Garba Groove Passes -> garba_groove__PASS__order_id
// Table 2: Garba Groove Donations -> garba_groove__DONATION__order_id
// Table 3: Navratri Utsav Passes -> navratri_utsav__PASS__order_id
// Table 4: Navratri Utsav Donations -> navratri_utsav__DONATION__order_id
export async function getExistingRecordKeys(): Promise<Set<string>> {
  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    try {
      const keys = new Set<string>();

      // Fetch order_ids from all 4 active tables in parallel
      const [ggPasses, ggDonations, nuPasses, nuDonations] = await Promise.all([
        fetchAllFromSupabase<{ order_id: string }>(client, 'garba_groove_passes', 'order_id'),
        fetchAllFromSupabase<{ order_id: string }>(client, 'garba_groove_donations', 'order_id'),
        fetchAllFromSupabase<{ order_id: string }>(client, 'navratri_utsav_passes', 'order_id'),
        fetchAllFromSupabase<{ order_id: string }>(client, 'navratri_utsav_donations', 'order_id'),
      ]);

      ggPasses.forEach((r) => keys.add(`garba_groove__PASS__${r.order_id}`));
      ggDonations.forEach((r) => keys.add(`garba_groove__DONATION__${r.order_id}`));
      nuPasses.forEach((r) => keys.add(`navratri_utsav__PASS__${r.order_id}`));
      nuDonations.forEach((r) => keys.add(`navratri_utsav__DONATION__${r.order_id}`));

      return keys;
    } catch (err) {
      console.warn('Supabase getExistingRecordKeys error, falling back to local store:', err);
    }
  }

  const local = readLocalDb();
  return new Set(local.records.map((r) => `${r.event_id || 'garba_groove'}__${r.record_type || 'PASS'}__${r.order_id}`));
}

export async function getExistingOrderIds(): Promise<Set<string>> {
  const keys = await getExistingRecordKeys();
  const ids = new Set<string>();
  keys.forEach((k) => {
    const parts = k.split('__');
    ids.add(parts[parts.length - 1]);
  });
  return ids;
}

// Insert Import Batch
export async function createImportBatch(batch: ImportBatch): Promise<ImportBatch> {
  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    try {
      const { data, error } = await client.from('import_batches').insert([batch]).select().single();
      if (!error && data) return data as ImportBatch;
      console.warn('Failed to insert batch into Supabase, saving to local store:', error?.message);
    } catch (err) {
      console.warn('Supabase batch insert error:', err);
    }
  }

  const local = readLocalDb();
  local.batches.unshift(batch);
  writeLocalDb(local);
  return batch;
}

// Update Import Batch
export async function updateImportBatch(id: string, updates: Partial<ImportBatch>): Promise<void> {
  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    try {
      await client.from('import_batches').update(updates).eq('id', id);
    } catch (err) {
      console.warn('Supabase batch update error:', err);
    }
  }

  const local = readLocalDb();
  const idx = local.batches.findIndex((b) => b.id === id);
  if (idx !== -1) {
    local.batches[idx] = { ...local.batches[idx], ...updates, updated_at: new Date().toISOString() };
    writeLocalDb(local);
  }
}

// Helper: Bulk insert/upsert records into a specific table (skipping existing order_ids gracefully)
async function bulkInsertToTable(
  client: SupabaseClient,
  tableName: string,
  records: EventRecord[]
): Promise<number> {
  if (records.length === 0) return 0;
  const chunkSize = 100;
  let count = 0;

  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize).map(r => {
      const { attendance_status, checked_in_at, ...clean } = r;
      return clean;
    });

    // Use upsert with ignoreDuplicates so existing order_ids never abort the insertion of new records
    const { data, error } = await client
      .from(tableName)
      .upsert(chunk, { onConflict: 'order_id', ignoreDuplicates: true })
      .select('id');

    if (error) {
      console.error(`Upsert to ${tableName} failed: ${error.message}`);
      // Fallback: try individual inserts ignoring duplicates
      for (const row of chunk) {
        const { error: singleErr } = await client.from(tableName).upsert([row], { onConflict: 'order_id', ignoreDuplicates: true });
        if (!singleErr) count++;
      }
    } else {
      count += data?.length ?? chunk.length;
    }
  }
  return count;
}

// Insert Event Records directly into their respective event tables (passes vs donations)
export async function insertEventRecords(records: EventRecord[]): Promise<{ inserted: number; skipped: number; errors: Array<{ row: number; error: string }> }> {
  if (records.length === 0) return { inserted: 0, skipped: 0, errors: [] };

  const toInsert = records;

  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    try {
      // Group records into 4 separate buckets:
      const garbaPasses = toInsert.filter(r => r.event_id !== 'navratri_utsav' && r.record_type === 'PASS');
      const garbaDonations = toInsert.filter(r => r.event_id !== 'navratri_utsav' && r.record_type === 'DONATION');
      const navratriPasses = toInsert.filter(r => r.event_id === 'navratri_utsav' && r.record_type === 'PASS');
      const navratriDonations = toInsert.filter(r => r.event_id === 'navratri_utsav' && r.record_type === 'DONATION');

      const [gpCount, gdCount, npCount, ndCount] = await Promise.all([
        bulkInsertToTable(client, 'garba_groove_passes', garbaPasses),
        bulkInsertToTable(client, 'garba_groove_donations', garbaDonations),
        bulkInsertToTable(client, 'navratri_utsav_passes', navratriPasses),
        bulkInsertToTable(client, 'navratri_utsav_donations', navratriDonations),
      ]);

      return { inserted: gpCount + gdCount + npCount + ndCount, skipped: 0, errors: [] };
    } catch (err) {
      console.warn('Supabase bulk insert failed, storing locally:', err);
    }
  }

  const local = readLocalDb();
  // Filter out any local duplicates by order_id + record_type
  const existingSet = new Set(local.records.map(r => `${r.event_id}__${r.record_type}__${r.order_id}`));
  const uniqueToInsert = toInsert.filter(r => !existingSet.has(`${r.event_id}__${r.record_type}__${r.order_id}`));
  local.records.push(...uniqueToInsert);
  writeLocalDb(local);
  return { inserted: uniqueToInsert.length, skipped: toInsert.length - uniqueToInsert.length, errors: [] };
}

// Amount a single record contributes to revenue. Uses the item's own payment amount: total_payment_amount is
// the whole Razorpay order, so an order with a pass and a donation would otherwise be counted in full twice.
// Dashboard figures count only payments Razorpay marked captured
export function isCapturedRecord(r: Pick<EventRecord, 'payment_status'>): boolean {
  return (r.payment_status || '').trim().toLowerCase() === 'captured';
}

export function recordAmount(r: Pick<EventRecord, 'item_payment_amount' | 'total_payment_amount'>): number {
  return Number(r.item_payment_amount) || Number(r.total_payment_amount) || 0;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatHourRange(hour: number): { hourLabel: string; hourDisplay: string; isoHour: string } {
  const h = Math.max(0, Math.min(23, isNaN(hour) ? 0 : hour));
  const startPeriod = h >= 12 ? 'PM' : 'AM';
  const startH12 = h % 12 === 0 ? 12 : h % 12;
  const startStr = `${String(startH12).padStart(2, '0')}:00 ${startPeriod}`;
  const startShort = `${String(startH12).padStart(2, '0')} ${startPeriod}`;

  const nextH = (h + 1) % 24;
  const nextPeriod = nextH >= 12 ? 'PM' : 'AM';
  const nextH12 = nextH % 12 === 0 ? 12 : nextH % 12;
  const nextStr = `${String(nextH12).padStart(2, '0')}:00 ${nextPeriod}`;

  return {
    hourLabel: startShort,
    hourDisplay: `${startStr} - ${nextStr}`,
    isoHour: String(h).padStart(2, '0'),
  };
}

export function parseRecordDateTime(dateStr?: string): {
  isoDate: string;
  displayDate: string;
  hour: number;
  isoHour: string;
  hourDisplay: string;
  hourLabel: string;
} {
  if (!dateStr || !dateStr.trim()) {
    const { hourLabel, hourDisplay, isoHour } = formatHourRange(0);
    return { isoDate: 'unknown', displayDate: 'Date Unspecified', hour: 0, isoHour, hourDisplay, hourLabel };
  }
  const trimmed = dateStr.trim();

  // Pattern: DD/MM/YYYY HH:mm:ss or DD-MM-YYYY HH:mm:ss
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    const hour = dmyMatch[4] !== undefined ? parseInt(dmyMatch[4], 10) : 0;

    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const displayDate = `${day} ${MONTH_NAMES[month - 1] || month} ${year}`;
    const { hourLabel, hourDisplay, isoHour } = formatHourRange(hour);
    return { isoDate, displayDate, hour, isoHour, hourDisplay, hourLabel };
  }

  // Pattern: YYYY-MM-DD HH:mm:ss
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    const hour = ymdMatch[4] !== undefined ? parseInt(ymdMatch[4], 10) : 0;

    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const displayDate = `${day} ${MONTH_NAMES[month - 1] || month} ${year}`;
    const { hourLabel, hourDisplay, isoHour } = formatHourRange(hour);
    return { isoDate, displayDate, hour, isoHour, hourDisplay, hourLabel };
  }

  // Standard JS Date parsing
  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const hour = d.getHours();
      const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const displayDate = `${day} ${MONTH_NAMES[month - 1] || month} ${year}`;
      const { hourLabel, hourDisplay, isoHour } = formatHourRange(hour);
      return { isoDate, displayDate, hour, isoHour, hourDisplay, hourLabel };
    }
  } catch {}

  const simple = trimmed.split(' ')[0] || 'Unknown';
  const { hourLabel, hourDisplay, isoHour } = formatHourRange(0);
  return { isoDate: simple, displayDate: simple, hour: 0, isoHour, hourDisplay, hourLabel };
}

export function parseRecordDate(dateStr?: string): { isoDate: string; displayDate: string } {
  const { isoDate, displayDate } = parseRecordDateTime(dateStr);
  return { isoDate, displayDate };
}

// Compute Hourly Breakdown Statistics
export function computeHourlyStats(records: EventRecord[]): import('./types').HourlyStat[] {
  const hourMap = new Map<number, {
    passTransactions: number;
    totalPasses: number;
    totalPassAmount: number;
    donationTransactions: number;
    totalDonationAmount: number;
    divisionMap: Map<string, {
      passTransactions: number;
      totalPasses: number;
      totalPassAmount: number;
      donationTransactions: number;
      totalDonationAmount: number;
    }>;
  }>();

  for (let h = 0; h < 24; h++) {
    hourMap.set(h, {
      passTransactions: 0,
      totalPasses: 0,
      totalPassAmount: 0,
      donationTransactions: 0,
      totalDonationAmount: 0,
      divisionMap: new Map(),
    });
  }

  for (const r of records) {
    const { hour } = parseRecordDateTime(r.payment_date || r.created_at);
    const validHour = Math.max(0, Math.min(23, isNaN(hour) ? 0 : hour));
    const hData = hourMap.get(validHour)!;

    const rawDiv = (r.divisions || '').trim();
    const divName = rawDiv && rawDiv !== 'null' && rawDiv !== 'undefined' ? rawDiv : 'Direct / Unassigned';

    if (!hData.divisionMap.has(divName)) {
      hData.divisionMap.set(divName, {
        passTransactions: 0,
        totalPasses: 0,
        totalPassAmount: 0,
        donationTransactions: 0,
        totalDonationAmount: 0,
      });
    }
    const divEntry = hData.divisionMap.get(divName)!;

    if (r.record_type === 'PASS') {
      const qty = Number(r.item_quantity) || 1;
      const amt = recordAmount(r);
      hData.passTransactions++;
      hData.totalPasses += qty;
      hData.totalPassAmount += amt;
      divEntry.passTransactions++;
      divEntry.totalPasses += qty;
      divEntry.totalPassAmount += amt;
    } else if (r.record_type === 'DONATION') {
      const amt = recordAmount(r);
      hData.donationTransactions++;
      hData.totalDonationAmount += amt;
      divEntry.donationTransactions++;
      divEntry.totalDonationAmount += amt;
    }
  }

  const result: import('./types').HourlyStat[] = [];
  for (let h = 0; h < 24; h++) {
    const dData = hourMap.get(h)!;
    const { hourLabel, hourDisplay, isoHour } = formatHourRange(h);

    const divisionStats: DayDivisionStat[] = [];
    for (const [division, divD] of dData.divisionMap.entries()) {
      divisionStats.push({
        division,
        passTransactions: divD.passTransactions,
        totalPasses: divD.totalPasses,
        totalPassAmount: divD.totalPassAmount,
        donationTransactions: divD.donationTransactions,
        totalDonationAmount: divD.totalDonationAmount,
        totalRevenue: divD.totalPassAmount + divD.totalDonationAmount,
        totalTransactions: divD.passTransactions + divD.donationTransactions,
      });
    }

    divisionStats.sort((a, b) => b.totalPasses - a.totalPasses || b.totalDonationAmount - a.totalDonationAmount);

    result.push({
      hour: h,
      hourLabel,
      hourDisplay,
      isoHour,
      passTransactions: dData.passTransactions,
      totalPasses: dData.totalPasses,
      totalPassAmount: dData.totalPassAmount,
      donationTransactions: dData.donationTransactions,
      totalDonationAmount: dData.totalDonationAmount,
      totalRevenue: dData.totalPassAmount + dData.totalDonationAmount,
      totalTransactions: dData.passTransactions + dData.donationTransactions,
      divisionStats,
    });
  }

  return result;
}

// Compute Overall Day-Wise & Day-Wise Division Statistics
export function computeDayWiseStats(records: EventRecord[]): DayWiseStat[] {
  const dayMap = new Map<
    string,
    {
      displayDate: string;
      records: EventRecord[];
      passTransactions: number;
      totalPasses: number;
      totalPassAmount: number;
      donationTransactions: number;
      totalDonationAmount: number;
      divisionMap: Map<
        string,
        {
          passTransactions: number;
          totalPasses: number;
          totalPassAmount: number;
          donationTransactions: number;
          totalDonationAmount: number;
        }
      >;
    }
  >();

  for (const r of records) {
    const { isoDate, displayDate } = parseRecordDateTime(r.payment_date || r.created_at);
    if (!dayMap.has(isoDate)) {
      dayMap.set(isoDate, {
        displayDate,
        records: [],
        passTransactions: 0,
        totalPasses: 0,
        totalPassAmount: 0,
        donationTransactions: 0,
        totalDonationAmount: 0,
        divisionMap: new Map(),
      });
    }

    const day = dayMap.get(isoDate)!;
    day.records.push(r);
    const rawDiv = (r.divisions || '').trim();
    const divName = rawDiv && rawDiv !== 'null' && rawDiv !== 'undefined' ? rawDiv : 'Direct / Unassigned';

    if (!day.divisionMap.has(divName)) {
      day.divisionMap.set(divName, {
        passTransactions: 0,
        totalPasses: 0,
        totalPassAmount: 0,
        donationTransactions: 0,
        totalDonationAmount: 0,
      });
    }
    const divEntry = day.divisionMap.get(divName)!;

    if (r.record_type === 'PASS') {
      const qty = Number(r.item_quantity) || 1;
      const amt = recordAmount(r);
      day.passTransactions++;
      day.totalPasses += qty;
      day.totalPassAmount += amt;
      divEntry.passTransactions++;
      divEntry.totalPasses += qty;
      divEntry.totalPassAmount += amt;
    } else if (r.record_type === 'DONATION') {
      const amt = recordAmount(r);
      day.donationTransactions++;
      day.totalDonationAmount += amt;
      divEntry.donationTransactions++;
      divEntry.totalDonationAmount += amt;
    }
  }

  const result: DayWiseStat[] = [];
  for (const [date, data] of dayMap.entries()) {
    const divisionStats: DayDivisionStat[] = [];
    for (const [division, dData] of data.divisionMap.entries()) {
      divisionStats.push({
        division,
        passTransactions: dData.passTransactions,
        totalPasses: dData.totalPasses,
        totalPassAmount: dData.totalPassAmount,
        donationTransactions: dData.donationTransactions,
        totalDonationAmount: dData.totalDonationAmount,
        totalRevenue: dData.totalPassAmount + dData.totalDonationAmount,
        totalTransactions: dData.passTransactions + dData.donationTransactions,
      });
    }

    divisionStats.sort((a, b) => b.totalPasses - a.totalPasses || b.totalDonationAmount - a.totalDonationAmount);

    const hourlyStats = computeHourlyStats(data.records);

    result.push({
      date,
      displayDate: data.displayDate,
      passTransactions: data.passTransactions,
      totalPasses: data.totalPasses,
      totalPassAmount: data.totalPassAmount,
      donationTransactions: data.donationTransactions,
      totalDonationAmount: data.totalDonationAmount,
      totalRevenue: data.totalPassAmount + data.totalDonationAmount,
      totalTransactions: data.passTransactions + data.donationTransactions,
      divisionStats,
      hourlyStats,
    });
  }

  return result.sort((a, b) => b.date.localeCompare(a.date));
}

// Helper: Format volunteer display name in proper Title Case
export function formatVolunteerDisplayName(name: string): string {
  if (!name || name.trim() === '') return 'Direct';
  const clean = name.trim().replace(/\s+/g, ' ');
  if (['direct', 'unassigned', 'none', 'null', 'undefined', 'n/a', '-'].includes(clean.toLowerCase())) {
    return 'Direct';
  }
  return clean
    .split(' ')
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');
}

// Helper: Normalize volunteer key for case and symbol agnostic matching
export function normalizeVolunteerKey(name: string): string {
  if (!name) return 'direct';
  const clean = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
  if (['direct', 'unassigned', 'none', 'null', 'undefined', 'na', ''].includes(clean)) {
    return 'direct';
  }
  return clean;
}

// Compute Division Wise Statistics with Daily Trajectory and Intelligent Volunteer Deduplication
export function computeDivisionStats(records: EventRecord[]): DivisionStats[] {
  const map = new Map<
    string,
    {
      passTransactions: number;
      totalPasses: number;
      totalPassAmount: number;
      donationTransactions: number;
      totalDonationAmount: number;
      rawVolunteers: Map<
        string,
        {
          normKey: string;
          displayNames: Map<string, number>; // name variation -> count
          l2Set: Set<string>;
          passes: number;
          passTransactions: number;
          donations: number;
          donationTransactions: number;
        }
      >;
      dayTrend: Map<string, { displayDate: string; passes: number; donations: number }>;
    }
  >();

  for (const r of records) {
    const rawDiv = (r.divisions || '').trim();
    const divName = rawDiv && rawDiv !== 'null' && rawDiv !== 'undefined' ? rawDiv : 'Direct / Unassigned';
    const { isoDate, displayDate } = parseRecordDate(r.payment_date || r.created_at);

    if (!map.has(divName)) {
      map.set(divName, {
        passTransactions: 0,
        totalPasses: 0,
        totalPassAmount: 0,
        donationTransactions: 0,
        totalDonationAmount: 0,
        rawVolunteers: new Map(),
        dayTrend: new Map(),
      });
    }

    const item = map.get(divName)!;
    const rawVolName = (r.referred_volunteer || '').trim() || 'Direct';
    const normKey = normalizeVolunteerKey(rawVolName);
    const rawL2 = (r.l2 || '').trim();

    if (!item.rawVolunteers.has(normKey)) {
      item.rawVolunteers.set(normKey, {
        normKey,
        displayNames: new Map(),
        l2Set: new Set(),
        passes: 0,
        passTransactions: 0,
        donations: 0,
        donationTransactions: 0,
      });
    }
    const vol = item.rawVolunteers.get(normKey)!;

    // Track original display name frequency for best canonical casing selection
    const formattedDisplay = formatVolunteerDisplayName(rawVolName);
    vol.displayNames.set(formattedDisplay, (vol.displayNames.get(formattedDisplay) || 0) + 1);

    if (rawL2 && rawL2 !== 'null' && rawL2 !== 'undefined' && rawL2 !== '-') {
      vol.l2Set.add(rawL2.toUpperCase());
    }

    if (!item.dayTrend.has(isoDate)) {
      item.dayTrend.set(isoDate, { displayDate, passes: 0, donations: 0 });
    }
    const dayItem = item.dayTrend.get(isoDate)!;

    if (r.record_type === 'PASS') {
      const qty = Number(r.item_quantity) || 1;
      const amt = recordAmount(r);
      item.passTransactions++;
      item.totalPasses += qty;
      item.totalPassAmount += amt;
      vol.passes += qty;
      vol.passTransactions++;
      dayItem.passes += qty;
    } else if (r.record_type === 'DONATION') {
      const amt = recordAmount(r);
      item.donationTransactions++;
      item.totalDonationAmount += amt;
      vol.donations += amt;
      vol.donationTransactions++;
      dayItem.donations += amt;
    }
  }

  const result: DivisionStats[] = [];

  for (const [division, data] of map.entries()) {
    // PASS 2: Consolidate single-word or partial aliases (e.g. "Simran" -> "Simran Gupta")
    // Find all multi-word volunteer keys in this division
    const allNormKeys = Array.from(data.rawVolunteers.keys());
    const multiWordKeys = allNormKeys.filter((k) => k !== 'direct' && k.includes(' '));

    // Map of alias key -> target canonical key
    const aliasMap = new Map<string, string>();

    for (const key of allNormKeys) {
      if (key === 'direct') continue;

      // If key is a single word (e.g. "simran") or shortened initial (e.g. "simran g")
      if (!key.includes(' ')) {
        // Find matching candidates that start with "${key} "
        const candidates = multiWordKeys.filter((mw) => mw.startsWith(`${key} `));

        // If there's an exact single candidate under this division, merge them!
        if (candidates.length === 1) {
          aliasMap.set(key, candidates[0]);
        } else if (candidates.length > 1) {
          // If multiple, check if L2 matches exclusively
          const volL2Set = data.rawVolunteers.get(key)!.l2Set;
          const l2Filtered = candidates.filter((mw) => {
            const mwL2Set = data.rawVolunteers.get(mw)!.l2Set;
            for (const l2 of volL2Set) {
              if (mwL2Set.has(l2)) return true;
            }
            return false;
          });
          if (l2Filtered.length === 1) {
            aliasMap.set(key, l2Filtered[0]);
          }
        }
      } else {
        // Check for initial matching, e.g. "simran g" -> "simran gupta"
        const parts = key.split(' ');
        if (parts.length === 2 && parts[1].length === 1) {
          const prefix = `${parts[0]} ${parts[1]}`;
          const candidates = multiWordKeys.filter((mw) => mw !== key && mw.startsWith(prefix));
          if (candidates.length === 1) {
            aliasMap.set(key, candidates[0]);
          }
        }
      }
    }

    // Consolidated volunteers map
    const consolidated = new Map<
      string,
      {
        canonicalName: string;
        l2Set: Set<string>;
        passes: number;
        passTransactions: number;
        donations: number;
        donationTransactions: number;
      }
    >();

    for (const [key, rawVol] of data.rawVolunteers.entries()) {
      const targetKey = aliasMap.get(key) || key;

      if (!consolidated.has(targetKey)) {
        // Pick best display name for target
        const targetRaw = data.rawVolunteers.get(targetKey);
        let bestName = 'Direct';
        if (targetRaw) {
          const sortedNames = Array.from(targetRaw.displayNames.entries()).sort((a, b) => b[1] - a[1]);
          bestName = sortedNames[0]?.[0] || formatVolunteerDisplayName(targetKey);
        } else {
          bestName = formatVolunteerDisplayName(targetKey);
        }

        consolidated.set(targetKey, {
          canonicalName: bestName,
          l2Set: new Set(),
          passes: 0,
          passTransactions: 0,
          donations: 0,
          donationTransactions: 0,
        });
      }

      const cEntry = consolidated.get(targetKey)!;
      cEntry.passes += rawVol.passes;
      cEntry.passTransactions += rawVol.passTransactions;
      cEntry.donations += rawVol.donations;
      cEntry.donationTransactions += rawVol.donationTransactions;
      rawVol.l2Set.forEach((l2) => cEntry.l2Set.add(l2));
    }

    const allVolunteers: VolunteerStat[] = Array.from(consolidated.values())
      .map((v) => ({
        name: v.canonicalName,
        l2: Array.from(v.l2Set).join(', ') || '-',
        division: division,
        passes: v.passes,
        passTransactions: v.passTransactions,
        donations: v.donations,
        donationTransactions: v.donationTransactions,
        totalTransactions: v.passTransactions + v.donationTransactions,
      }))
      .sort((a, b) => b.passes - a.passes || b.donations - a.donations || a.name.localeCompare(b.name));

    const topVolunteers = allVolunteers
      .slice(0, 5)
      .map((v) => ({ name: v.name, passes: v.passes, donations: v.donations }));

    const dayWiseTrend = Array.from(data.dayTrend.entries())
      .map(([date, t]) => ({ date, displayDate: t.displayDate, passes: t.passes, donations: t.donations }))
      .sort((a, b) => a.date.localeCompare(b.date));

    result.push({
      division,
      passTransactions: data.passTransactions,
      totalPasses: data.totalPasses,
      totalPassAmount: data.totalPassAmount,
      donationTransactions: data.donationTransactions,
      totalDonationAmount: data.totalDonationAmount,
      totalRevenue: data.totalPassAmount + data.totalDonationAmount,
      totalTransactions: data.passTransactions + data.donationTransactions,
      volunteersCount: consolidated.size,
      topVolunteers,
      allVolunteers,
      dayWiseTrend,
    });
  }

  return result.sort((a, b) => b.totalPasses - a.totalPasses || b.totalDonationAmount - a.totalDonationAmount);
}

// Fetch all records from the 4 active Supabase tables with full pagination
async function fetchSupabaseRecords(client: SupabaseClient, eventId?: string): Promise<EventRecord[]> {
  if (eventId === 'garba_groove') {
    const [passes, donations] = await Promise.all([
      fetchAllFromSupabase<EventRecord>(client, 'garba_groove_passes'),
      fetchAllFromSupabase<EventRecord>(client, 'garba_groove_donations'),
    ]);
    return [...passes, ...donations];
  }

  if (eventId === 'navratri_utsav') {
    const [passes, donations] = await Promise.all([
      fetchAllFromSupabase<EventRecord>(client, 'navratri_utsav_passes'),
      fetchAllFromSupabase<EventRecord>(client, 'navratri_utsav_donations'),
    ]);
    return [...passes, ...donations];
  }

  // 'all' or unspecified: fetch from all 4 tables
  const [ggPasses, ggDonations, nuPasses, nuDonations] = await Promise.all([
    fetchAllFromSupabase<EventRecord>(client, 'garba_groove_passes'),
    fetchAllFromSupabase<EventRecord>(client, 'garba_groove_donations'),
    fetchAllFromSupabase<EventRecord>(client, 'navratri_utsav_passes'),
    fetchAllFromSupabase<EventRecord>(client, 'navratri_utsav_donations'),
  ]);
  return [...ggPasses, ...ggDonations, ...nuPasses, ...nuDonations];
}

// Get Dashboard Statistics with Event Scope, Division Breakdown & Day-Wise Analytics
export async function getDashboardStats(eventId?: string): Promise<DashboardStats> {
  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    try {
      let batchQuery = client.from('import_batches').select('*').order('created_at', { ascending: false });
      if (eventId && eventId !== 'all') {
        batchQuery = batchQuery.eq('event_id', eventId);
      }

      const [allRecords, { data: latestBatches }] = await Promise.all([
        fetchSupabaseRecords(client, eventId),
        batchQuery.limit(1),
      ]);
      const records = allRecords.filter(isCapturedRecord);

      const passes = records.filter((r) => r.record_type === 'PASS');
      const donations = records.filter((r) => r.record_type === 'DONATION');

      const totalCapturedPasses = passes.reduce((acc, curr) => acc + (Number(curr.item_quantity) || 1), 0);
      const totalCapturedPassAmount = passes.reduce((acc, curr) => acc + recordAmount(curr), 0);
      const passTransactions = passes.length;
      const capturedDonations = donations.length;
      const totalDonationAmount = donations.reduce((acc, curr) => acc + recordAmount(curr), 0);
      const totalRevenue = totalCapturedPassAmount + totalDonationAmount;

      const divisionStats = computeDivisionStats(records);
      const dayWiseStats = computeDayWiseStats(records);
      const hourlyStats = computeHourlyStats(records);

      return {
        totalCapturedPasses,
        totalCapturedPassAmount,
        passTransactions,
        capturedDonations,
        totalDonationAmount,
        totalRevenue,
        totalCapturedRows: passTransactions + capturedDonations,
        totalImportedBatches: latestBatches?.length ? 1 : 0,
        latestImport: latestBatches && latestBatches.length > 0 ? latestBatches[0] : null,
        divisionStats,
        dayWiseStats,
        hourlyStats,
      };
    } catch (err) {
      console.warn('Supabase getDashboardStats error, using local store:', err);
    }
  }

  const local = readLocalDb();
  let records = local.records.filter(isCapturedRecord);
  let batches = local.batches;

  if (eventId && eventId !== 'all') {
    records = records.filter((r) => (r.event_id || 'garba_groove') === eventId);
    batches = batches.filter((b) => (b.event_id || 'garba_groove') === eventId);
  }

  const passes = records.filter((r) => r.record_type === 'PASS');
  const donations = records.filter((r) => r.record_type === 'DONATION');

  const totalCapturedPasses = passes.reduce((acc, curr) => acc + (Number(curr.item_quantity) || 1), 0);
  const totalCapturedPassAmount = passes.reduce((acc, curr) => acc + recordAmount(curr), 0);
  const passTransactions = passes.length;
  const capturedDonations = donations.length;
  const totalDonationAmount = donations.reduce((acc, curr) => acc + recordAmount(curr), 0);
  const totalRevenue = totalCapturedPassAmount + totalDonationAmount;

  const divisionStats = computeDivisionStats(records);
  const dayWiseStats = computeDayWiseStats(records);
  const hourlyStats = computeHourlyStats(records);

  return {
    totalCapturedPasses,
    totalCapturedPassAmount,
    passTransactions,
    capturedDonations,
    totalDonationAmount,
    totalRevenue,
    totalCapturedRows: passTransactions + capturedDonations,
    totalImportedBatches: batches.length,
    latestImport: batches.length > 0 ? batches[0] : null,
    divisionStats,
    dayWiseStats,
    hourlyStats,
  };
}

// Get paginated / filtered records
export async function getRecords(params: {
  type?: 'PASS' | 'DONATION';
  eventId?: string;
  search?: string;
  division?: string;
  date?: string;
  hour?: number | string;
  paymentStatus?: string; // e.g. 'manual' to list only admin-entered passes
  limit?: number;
  offset?: number;
}): Promise<{ records: EventRecord[]; total: number }> {
  const { type, eventId, search, division, date, hour, paymentStatus, limit = 50, offset = 0 } = params;

  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    try {
      // Event/type pick the tables; division and search run in the database. Date/hour stay in JS because
      // payment_date is free-form text from the Razorpay export.
      const searchTerm = sanitizeSearchTerm(search);
      const perTable = await Promise.all(
        recordTablesFor(eventId, type).map((table) =>
          fetchAllMatching(client, table, (query) => {
            let q = query;
            if (division && division !== 'all') q = q.eq('divisions', division);
            if (paymentStatus) q = q.eq('payment_status', paymentStatus);
            if (searchTerm) {
              q = q.or(SEARCH_COLUMNS.map((col) => `${col}.ilike.%${searchTerm}%`).join(','));
            }
            return q;
          })
        )
      );
      let records = perTable.flat();

      if (date && date !== 'all') {
        records = records.filter((r) => parseRecordDateTime(r.payment_date || r.created_at).isoDate === date);
      }
      if (hour !== undefined && hour !== null && hour !== 'all' && String(hour).trim() !== '') {
        const targetH = Number(hour);
        records = records.filter((r) => parseRecordDateTime(r.payment_date || r.created_at).hour === targetH);
      }

      records.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      const total = records.length;
      const paginated = records.slice(offset, offset + limit);
      return { records: paginated, total };
    } catch (err) {
      console.warn('Supabase getRecords error, fallback local:', err);
    }
  }

  const local = readLocalDb();
  let list = local.records;
  if (type) {
    list = list.filter((r) => r.record_type === type);
  }
  if (eventId && eventId !== 'all') {
    list = list.filter((r) => (r.event_id || 'garba_groove') === eventId);
  }
  if (division && division !== 'all') {
    list = list.filter((r) => r.divisions === division);
  }
  if (paymentStatus) {
    list = list.filter((r) => r.payment_status === paymentStatus);
  }
  if (date && date !== 'all') {
    list = list.filter((r) => parseRecordDateTime(r.payment_date || r.created_at).isoDate === date);
  }
  if (hour !== undefined && hour !== null && hour !== 'all' && String(hour).trim() !== '') {
    const targetH = Number(hour);
    list = list.filter((r) => parseRecordDateTime(r.payment_date || r.created_at).hour === targetH);
  }
  if (search && search.trim()) {
    const s = search.trim().toLowerCase();
    list = list.filter(
      (r) =>
        r.order_id?.toLowerCase().includes(s) ||
        r.name?.toLowerCase().includes(s) ||
        r.email?.toLowerCase().includes(s) ||
        r.phone?.toLowerCase().includes(s) ||
        r.payment_id?.toLowerCase().includes(s) ||
        r.divisions?.toLowerCase().includes(s) ||
        r.referred_volunteer?.toLowerCase().includes(s)
    );
  }
  const total = list.length;
  const paginated = list.slice(offset, offset + limit);
  return { records: paginated, total };
}

// Fetch specific records by their order_ids
export async function getRecordsByOrderIds(orderIds: string[]): Promise<EventRecord[]> {
  if (!orderIds || orderIds.length === 0) return [];

  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    try {
      // .in() per table in chunks (keeps the request URL short) instead of downloading every record
      const unique = Array.from(new Set(orderIds));
      const chunkSize = 150;
      const matched: EventRecord[] = [];
      for (let i = 0; i < unique.length; i += chunkSize) {
        const chunk = unique.slice(i, i + chunkSize);
        const results = await Promise.all(
          ALL_RECORD_TABLES.map((table) => client.from(table).select('*').in('order_id', chunk))
        );
        for (const { data, error } of results) {
          if (error) throw new Error(error.message);
          matched.push(...((data || []) as EventRecord[]));
        }
      }
      if (matched.length > 0) return matched;
    } catch (err) {
      console.warn('Supabase getRecordsByOrderIds error, fallback local:', err);
    }
  }

  const local = readLocalDb();
  return local.records.filter((r) => orderIds.includes(r.order_id));
}

// Update Email Status across all 4 active tables
export async function updateRecordEmailStatus(
  orderId: string,
  status: EmailStatus,
  sentAt: string | null = null,
  lastAttemptAt: string | null = null,
  errorMessage: string | null = null
): Promise<void> {
  const attemptTime = lastAttemptAt || new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    email_status: status,
    email_last_attempt_at: attemptTime,
    email_error: errorMessage || null,
  };

  if (status === 'Sent') {
    updatePayload.email_sent_at = sentAt || attemptTime;
    updatePayload.email_error = null;
  }

  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    // Core columns exist in every schema version; tracking columns need supabase/add_email_tracking_columns.sql
    const corePayload: Record<string, unknown> = { email_status: status };
    if (status === 'Sent') corePayload.email_sent_at = updatePayload.email_sent_at;

    // Retry with pauses: on a flaky connection a lost update left a delivered pass stuck on "Sending"
    const retryDelaysMs = [0, 1000, 3000];
    await Promise.all(
      ALL_RECORD_TABLES.map(async (table) => {
        let payload = updatePayload;
        let lastError = '';
        for (const delay of retryDelaysMs) {
          if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
          const { error } = await client.from(table).update(payload).eq('order_id', orderId);
          if (!error) return;
          lastError = error.message;
          if (payload !== corePayload && /email_last_attempt_at|email_error|column/i.test(error.message)) {
            console.warn(`updateRecordEmailStatus on ${table}: ${error.message}; retrying with core columns`);
            payload = corePayload;
          }
        }
        console.error(`updateRecordEmailStatus on ${table} failed after retries: ${lastError}`);
      })
    );
  }

  const local = readLocalDb();
  const idx = local.records.findIndex((r) => r.order_id === orderId);
  if (idx !== -1) {
    local.records[idx] = {
      ...local.records[idx],
      email_status: status,
      email_last_attempt_at: attemptTime,
      email_error: errorMessage || null,
      ...(status === 'Sent' ? { email_sent_at: sentAt || attemptTime, email_error: null } : {}),
    };
    writeLocalDb(local);
  }
}

/**
 * Replace a pass holder's email (e.g. after a bounce) and reset it to Pending so it can be sent again.
 * Returns the updated record, or null if no pass has that order_id.
 */
export async function updatePassEmail(orderId: string, email: string): Promise<EventRecord | null> {
  const payload = { email, email_status: 'Pending', email_error: null, email_sent_at: null };
  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    for (const table of ['garba_groove_passes', 'navratri_utsav_passes']) {
      let { data, error } = await client.from(table).update(payload).eq('order_id', orderId).select();
      if (error && /email_error|column/i.test(error.message)) {
        // email_error not migrated yet: update without it
        const { email_error: _skip, ...core } = payload;
        ({ data, error } = await client.from(table).update(core).eq('order_id', orderId).select());
      }
      if (error) throw new Error(`Failed to update email: ${error.message}`);
      if (data && data.length > 0) return data[0] as EventRecord;
    }
    return null;
  }

  const local = readLocalDb();
  const idx = local.records.findIndex((r) => r.order_id === orderId && r.record_type === 'PASS');
  if (idx === -1) return null;
  local.records[idx] = { ...local.records[idx], ...payload, email_status: 'Pending' };
  writeLocalDb(local);
  return local.records[idx];
}

// ---------------------------------------------------------------------------
// MANUAL PASSES (entered by an admin, not from Razorpay)
// ---------------------------------------------------------------------------

export const MANUAL_CODE_PREFIX = 'SC';
export const MANUAL_PAYMENT_STATUS = 'manual';

// No look-alike characters (0/O, 1/I/L) so gate staff can read codes off a screen reliably
const MANUAL_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MANUAL_CODE_LENGTH = 8;

/** Random, unguessable pass code: "SC" + 8 characters, e.g. SC7KQ4M9XP */
function generateManualCode(): string {
  let code = MANUAL_CODE_PREFIX;
  for (let i = 0; i < MANUAL_CODE_LENGTH; i++) {
    code += MANUAL_CODE_ALPHABET[crypto.randomInt(MANUAL_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Create a manual pass with a random SC######## code. The code is the order_id (unique per table), so in
 * the (astronomically unlikely) event of a collision the insert fails and a fresh code is generated.
 */
export async function createManualPass(input: {
  eventId: 'garba_groove' | 'navratri_utsav';
  name: string;
  email: string;
  phone: string;
  quantity: number;
  amount: number;
  createdBy?: string;
}): Promise<EventRecord> {
  const tableName = getRecordTableName(input.eventId, 'PASS');
  const eventName = input.eventId === 'navratri_utsav' ? 'Navratri Utsav 2026' : 'Garba Groove 2026';
  const nowIso = new Date().toISOString();
  const client = getSupabaseClient();

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateManualCode();
    const record: EventRecord = {
      id: `rec_manual_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      order_id: code,
      code,
      event_id: input.eventId,
      event_name: eventName,
      record_type: 'PASS',
      payment_page_title: 'Manual entry',
      payment_date: nowIso,
      item_name: 'Dandiya pass',
      item_amount: input.quantity > 0 ? input.amount / input.quantity : 0,
      item_quantity: input.quantity,
      item_payment_amount: input.amount,
      total_payment_amount: input.amount,
      currency: 'INR',
      // Not a Razorpay capture: kept out of the captured-only sales/revenue figures
      payment_status: MANUAL_PAYMENT_STATUS,
      email: input.email,
      phone: input.phone,
      name: input.name,
      source_file: `manual_entry${input.createdBy ? `:${input.createdBy}` : ''}`,
      import_batch_id: '',
      email_status: 'Pending',
      email_sent_at: null,
      attendance_status: 'PENDING',
      checked_in_at: null,
      created_at: nowIso,
    };

    if (isUsingSupabase() && client) {
      const { import_batch_id: _noBatch, ...row } = record;
      const { error } = await client.from(tableName).insert([{ ...row, import_batch_id: null }]);
      if (!error) return record;
      if (error.code === '23505') continue; // code already used: generate another
      throw new Error(`Failed to save manual pass: ${error.message}`);
    }

    const local = readLocalDb();
    if (local.records.some((r) => r.order_id === code)) continue;
    local.records.push(record);
    writeLocalDb(local);
    return record;
  }
  throw new Error('Could not allocate a unique pass code; please try again.');
}

// Get All Batches with Event Filter
export async function getImportBatches(eventId?: string): Promise<ImportBatch[]> {
  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    try {
      const data = await fetchAllFromSupabase<ImportBatch>(client, 'import_batches');
      if (data && data.length > 0) {
        let list = data.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        if (eventId && eventId !== 'all') {
          list = list.filter((b) => (b.event_id || 'garba_groove') === eventId);
        }
        return list;
      }
    } catch (err) {
      console.warn('Supabase getImportBatches error:', err);
    }
  }

  const local = readLocalDb();
  if (eventId && eventId !== 'all') {
    return local.batches.filter((b) => (b.event_id || 'garba_groove') === eventId);
  }
  return local.batches;
}

// Get and Update Settings
export function getSettings(): SystemSettings {
  const local = readLocalDb();
  const envSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const envSupabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const envGoogleSpreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const envGarbaGrooveSpreadsheetId = process.env.GARBA_GROOVE_SPREADSHEET_ID;
  const envNavratriUtsavSpreadsheetId = process.env.NAVRATRI_UTSAV_SPREADSHEET_ID;
  const envGarbaPassBgUrl = process.env.GARBA_PASS_BG_URL;
  const envNavratriPassBgUrl = process.env.NAVRATRI_PASS_BG_URL;
  const envGoogleServiceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const envGooglePrivateKey = process.env.GOOGLE_PRIVATE_KEY;
  const envGoogleSheetsMode = process.env.GOOGLE_SHEETS_MODE as 'mock' | 'live' | undefined;

  return {
    ...DEFAULT_SETTINGS,
    ...(local.settings || {}),
    supabaseUrl: envSupabaseUrl || local.settings?.supabaseUrl,
    supabaseAnonKey: envSupabaseAnonKey || local.settings?.supabaseAnonKey,
    supabaseServiceKey: envSupabaseServiceKey || local.settings?.supabaseServiceKey,
    googleSpreadsheetId: envGoogleSpreadsheetId || local.settings?.googleSpreadsheetId,
    garbaGrooveSpreadsheetId: envGarbaGrooveSpreadsheetId || local.settings?.garbaGrooveSpreadsheetId,
    navratriUtsavSpreadsheetId: envNavratriUtsavSpreadsheetId || local.settings?.navratriUtsavSpreadsheetId,
    garbaPassBgUrl: envGarbaPassBgUrl || local.settings?.garbaPassBgUrl,
    navratriPassBgUrl: envNavratriPassBgUrl || local.settings?.navratriPassBgUrl,
    googleServiceAccountEmail: envGoogleServiceAccountEmail || local.settings?.googleServiceAccountEmail,
    googlePrivateKey: envGooglePrivateKey || local.settings?.googlePrivateKey,
    googleSheetsMode: envGoogleSheetsMode || local.settings?.googleSheetsMode || 'mock',
  };
}

export function saveSettings(settings: Partial<SystemSettings>): SystemSettings {
  const local = readLocalDb();
  local.settings = { ...local.settings, ...settings };
  writeLocalDb(local);
  return local.settings;
}

// Exact-match lookup across the 4 tables: order_id first (always equals code on import), then code.
// Uses .eq() rather than a hand-built .or() string so a crafted QR code can't alter the filter.
async function findSupabaseRecordByCode(client: SupabaseClient, code: string): Promise<EventRecord | null> {
  for (const column of ['order_id', 'code'] as const) {
    const results = await Promise.all(
      ALL_RECORD_TABLES.map((table) => client.from(table).select('*').eq(column, code).limit(1))
    );
    for (const { data, error } of results) {
      if (error) throw new Error(error.message);
      if (data && data.length > 0) return data[0] as EventRecord;
    }
  }
  return null;
}

// Get single record by code or order_id
export async function getRecordByCode(code: string): Promise<EventRecord | null> {
  if (!code || !code.trim()) return null;
  const trimmed = code.trim();

  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    try {
      const found = await findSupabaseRecordByCode(client, trimmed);
      if (found) return found;
    } catch (err) {
      console.warn('Supabase getRecordByCode error, fallback local:', err);
    }
  }

  const local = readLocalDb();
  const found = local.records.find(
    (r) => r.code?.trim() === trimmed || r.order_id?.trim() === trimmed
  );
  return found || null;
}

// Update attendance status ('PENDING' | 'PRESENT' | 'CANCELLED')
export async function updateAttendanceStatus(
  code: string,
  status: 'PENDING' | 'PRESENT' | 'CANCELLED'
): Promise<{ success: boolean; record?: EventRecord; error?: string }> {
  if (!code || !code.trim()) {
    return { success: false, error: 'Pass code or Order ID is required' };
  }

  const trimmed = code.trim();
  const checkedInAt = status === 'PRESENT' ? new Date().toISOString() : null;

  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    try {
      const target = await findSupabaseRecordByCode(client, trimmed);

      if (target) {
        // Resolve exact table from event_id + record_type
        const targetTable = getRecordTableName(target.event_id, target.record_type as 'PASS' | 'DONATION' || 'PASS');

        const { data, error } = await client
          .from(targetTable)
          .update({ attendance_status: status, checked_in_at: checkedInAt })
          .eq('id', target.id)
          .select();

        if (!error && data && data.length > 0) {
          return { success: true, record: data[0] as EventRecord };
        }

        if (error) {
          console.warn(`updateAttendanceStatus failed on ${targetTable}: ${error.message}`);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Supabase updateAttendanceStatus error';
      console.warn('Supabase updateAttendanceStatus error, updating locally:', message);
    }
  }

  const local = readLocalDb();
  const idx = local.records.findIndex(
    (r) => r.code?.trim() === trimmed || r.order_id?.trim() === trimmed
  );

  if (idx !== -1) {
    local.records[idx] = {
      ...local.records[idx],
      attendance_status: status,
      checked_in_at: checkedInAt,
    };
    writeLocalDb(local);
    return { success: true, record: local.records[idx] };
  }

  return { success: false, error: `Pass record for code "${trimmed}" not found in database.` };
}

// Clear all database records (Supabase & Local JSON)
export async function clearDatabase(): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  let supabaseCleared = false;
  let supabaseMsg = '';

  if (isUsingSupabase() && client) {
    try {
      await Promise.allSettled([
        client.from('garba_groove_passes').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        client.from('garba_groove_donations').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        client.from('navratri_utsav_passes').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        client.from('navratri_utsav_donations').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        client.from('import_batches').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        client.from('import_errors').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      ]);
      supabaseCleared = true;
      supabaseMsg = 'Supabase tables (passes, donations, import_batches, import_errors) cleared successfully.';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to clear Supabase';
      console.error('Failed to clear Supabase:', err);
      supabaseMsg = `Supabase clear notice: ${message}`;
    }
  }

  // Clear local JSON database
  const emptyDb: LocalDatabase = {
    batches: [],
    records: [],
    errors: [],
    settings: getSettings(),
  };
  writeLocalDb(emptyDb);

  return {
    success: true,
    message: supabaseCleared
      ? `Database cleared successfully! (${supabaseMsg})`
      : 'Local database cleared successfully.',
  };
}

// ---------------------------------------------------------------------------
// EMAIL BATCHES & ASYNC DISPATCH PERSISTENCE
// ---------------------------------------------------------------------------

export async function createEmailBatch(
  batch: import('./types').EmailBatch,
  jobs: import('./types').EmailDispatchLog[]
): Promise<void> {
  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    // Jobs must be durable in Supabase, otherwise workers on other serverless instances never see them
    const { error: batchErr } = await client.from('email_batches').upsert([batch], { onConflict: 'batch_id' });
    if (batchErr) {
      throw new Error(`Failed to create email batch in Supabase: ${batchErr.message}`);
    }
    // Chunk inserts for PostgREST
    const chunkSize = 100;
    for (let i = 0; i < jobs.length; i += chunkSize) {
      const { error: jobsErr } = await client
        .from('email_dispatch_logs')
        .upsert(jobs.slice(i, i + chunkSize), { onConflict: 'id' });
      if (jobsErr) {
        throw new Error(`Failed to queue email jobs in Supabase: ${jobsErr.message}`);
      }
    }
  }

  const local = readLocalDb();
  if (!local.email_batches) local.email_batches = [];
  if (!local.email_dispatch_logs) local.email_dispatch_logs = [];

  const bIdx = local.email_batches.findIndex((b) => b.batch_id === batch.batch_id);
  if (bIdx !== -1) {
    local.email_batches[bIdx] = batch;
  } else {
    local.email_batches.unshift(batch);
  }

  // Remove existing job records for same IDs and append new
  const jobIds = new Set(jobs.map((j) => j.id));
  local.email_dispatch_logs = local.email_dispatch_logs.filter((j) => !jobIds.has(j.id));
  local.email_dispatch_logs.push(...jobs);

  writeLocalDb(local);
}

export async function getEmailBatch(batchId: string): Promise<import('./types').EmailBatch | null> {
  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    let failure: string | null = null;
    try {
      const { data, error } = await client.from('email_batches').select('*').eq('batch_id', batchId).single();
      if (!error && data) return data as import('./types').EmailBatch;
      if (error && error.code !== 'PGRST116') failure = error.message; // PGRST116 = no such batch
    } catch (err) {
      failure = err instanceof Error ? err.message : String(err);
    }
    // A timeout on a flaky connection must not look like "batch not found" (pollers treated live batches as gone)
    if (failure) throw new Error(`Database temporarily unreachable: ${failure}`);
  }

  const local = readLocalDb();
  const found = (local.email_batches || []).find((b) => b.batch_id === batchId);
  return found || null;
}

/** Batches from the last 24h that still have work left, newest first (read-only, for progress display) */
export async function getActiveEmailBatches(): Promise<import('./types').EmailBatch[]> {
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const isActive = (b: import('./types').EmailBatch) =>
    !b.completed_at && b.queued + b.processing + b.retrying > 0 && b.created_at >= sinceIso;

  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    const { data, error } = await client
      .from('email_batches')
      .select('*')
      .is('completed_at', null)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw new Error(`Failed to read active email batches: ${error.message}`);
    return ((data || []) as import('./types').EmailBatch[]).filter(isActive);
  }

  return (readLocalDb().email_batches || []).filter(isActive);
}

export async function claimNextEmailJobs(
  batchId?: string,
  limit = 5
): Promise<import('./types').EmailDispatchLog[]> {
  const nowIso = new Date().toISOString();
  const client = getSupabaseClient();

  if (isUsingSupabase() && client) {
    try {
      let query = client
        .from('email_dispatch_logs')
        .select('*')
        .in('status', ['QUEUED', 'RETRYING'])
        .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (batchId) {
        query = query.eq('batch_id', batchId);
      }

      const { data: eligible, error } = await query;
      if (!error && eligible && eligible.length > 0) {
        const claimed: import('./types').EmailDispatchLog[] = [];
        for (const candidate of eligible) {
          // Atomic conditional update
          const { data: updated, error: updateErr } = await client
            .from('email_dispatch_logs')
            .update({
              status: 'PROCESSING',
              attempt_count: (candidate.attempt_count || 0) + 1,
              updated_at: nowIso,
            })
            .eq('id', candidate.id)
            .in('status', ['QUEUED', 'RETRYING'])
            .select()
            .single();

          if (!updateErr && updated) {
            claimed.push(updated as import('./types').EmailDispatchLog);
          }
        }
        if (claimed.length > 0) return claimed;
      }
    } catch (err) {
      console.warn('Supabase claimNextEmailJobs fallback local:', err);
    }
  }

  // Local Store Atomic Mutex Claim
  const local = readLocalDb();
  if (!local.email_dispatch_logs) local.email_dispatch_logs = [];
  const nowMs = Date.now();
  const claimed: import('./types').EmailDispatchLog[] = [];

  for (const job of local.email_dispatch_logs) {
    if (claimed.length >= limit) break;
    if (batchId && job.batch_id !== batchId) continue;

    if (job.status === 'QUEUED' || job.status === 'RETRYING') {
      const isRetryReady = !job.next_retry_at || new Date(job.next_retry_at).getTime() <= nowMs;
      if (isRetryReady) {
        job.status = 'PROCESSING';
        job.attempt_count = (job.attempt_count || 0) + 1;
        job.updated_at = nowIso;
        claimed.push({ ...job });
      }
    }
  }

  if (claimed.length > 0) {
    writeLocalDb(local);
  }

  return claimed;
}

export async function updateEmailDispatchJob(
  jobId: string,
  updates: Partial<import('./types').EmailDispatchLog>
): Promise<void> {
  const client = getSupabaseClient();
  const payload = { ...updates, updated_at: new Date().toISOString() };

  if (isUsingSupabase() && client) {
    try {
      const { error } = await client.from('email_dispatch_logs').update(payload).eq('id', jobId);
      if (error && 'smtp_account' in payload && error.message.includes('smtp_account')) {
        // smtp_account column not migrated yet: still persist the status so the job isn't stuck in PROCESSING
        const { smtp_account: _omit, ...withoutAccount } = payload;
        const { error: retryErr } = await client.from('email_dispatch_logs').update(withoutAccount).eq('id', jobId);
        if (retryErr) console.error(`updateEmailDispatchJob ${jobId} failed: ${retryErr.message}`);
      } else if (error) {
        console.error(`updateEmailDispatchJob ${jobId} failed: ${error.message}`);
      }
    } catch (err) {
      console.warn('Supabase updateEmailDispatchJob fallback local:', err);
    }
  }

  const local = readLocalDb();
  if (!local.email_dispatch_logs) local.email_dispatch_logs = [];
  const idx = local.email_dispatch_logs.findIndex((j) => j.id === jobId);
  if (idx !== -1) {
    local.email_dispatch_logs[idx] = { ...local.email_dispatch_logs[idx], ...payload };
    writeLocalDb(local);
  }
}

export async function updateEmailBatchCounts(
  batchId: string
): Promise<import('./types').EmailBatch | null> {
  const client = getSupabaseClient();
  let jobs: import('./types').EmailDispatchLog[] = [];

  if (isUsingSupabase() && client) {
    try {
      // Page through: PostgREST caps a response at 1000 rows, which undercounted large batches and
      // marked them complete while jobs past the first 1000 were still queued
      const pageSize = 1000;
      const all: import('./types').EmailDispatchLog[] = [];
      for (let page = 0; ; page++) {
        const { data, error } = await client
          .from('email_dispatch_logs')
          .select('id, status')
          .eq('batch_id', batchId)
          .order('id', { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw new Error(error.message);
        all.push(...((data || []) as import('./types').EmailDispatchLog[]));
        if (!data || data.length < pageSize) break;
      }
      jobs = all;
    } catch (err) {
      console.warn('Supabase updateEmailBatchCounts get jobs fallback local:', err);
    }
  }

  if (jobs.length === 0) {
    const local = readLocalDb();
    jobs = (local.email_dispatch_logs || []).filter((j) => j.batch_id === batchId);
  }

  const total = jobs.length;
  let queued = 0;
  let processing = 0;
  let sent = 0;
  let retrying = 0;
  let failed = 0;

  for (const j of jobs) {
    if (j.status === 'QUEUED') queued++;
    else if (j.status === 'PROCESSING') processing++;
    else if (j.status === 'SENT') sent++;
    else if (j.status === 'RETRYING') retrying++;
    else if (j.status === 'FAILED') failed++;
  }

  const isCompleted = total > 0 && queued === 0 && processing === 0 && retrying === 0;
  const completedAt = isCompleted ? new Date().toISOString() : null;

  const updates: Partial<import('./types').EmailBatch> = {
    total,
    queued,
    processing,
    sent,
    retrying,
    failed,
    ...(isCompleted ? { completed_at: completedAt } : {}),
  };

  if (isUsingSupabase() && client) {
    try {
      const { data } = await client
        .from('email_batches')
        .update(updates)
        .eq('batch_id', batchId)
        .select()
        .single();
      if (data) return data as import('./types').EmailBatch;
    } catch (err) {
      console.warn('Supabase updateEmailBatchCounts update fallback local:', err);
    }
  }

  const local = readLocalDb();
  if (!local.email_batches) local.email_batches = [];
  const idx = local.email_batches.findIndex((b) => b.batch_id === batchId);
  if (idx !== -1) {
    local.email_batches[idx] = { ...local.email_batches[idx], ...updates };
    writeLocalDb(local);
    return local.email_batches[idx];
  }

  return null;
}

export class SmtpAccountColumnMissingError extends Error {
  constructor() {
    super(
      'Multiple sender accounts are configured but email_dispatch_logs.smtp_account does not exist. ' +
        'Run supabase/add_email_tracking_columns.sql in the Supabase SQL editor.'
    );
  }
}

/**
 * Count emails SENT per sender account since `sinceIso`.
 * Logs written before multi-account rotation have no smtp_account; they were sent by the primary account.
 */
export async function getSmtpSentCounts(
  accounts: string[],
  primaryAccount: string,
  sinceIso: string
): Promise<Map<string, number>> {
  const counts = new Map<string, number>(accounts.map((a) => [a, 0]));
  const client = getSupabaseClient();

  if (isUsingSupabase() && client) {
    const results = await Promise.all(
      accounts.map(async (account) => {
        let query = client
          .from('email_dispatch_logs')
          .select('id', { count: 'exact' })
          .eq('status', 'SENT')
          .gte('sent_at', sinceIso);
        query =
          account === primaryAccount
            ? query.or(`smtp_account.eq."${account}",smtp_account.is.null`)
            : query.eq('smtp_account', account);
        const { count, error } = await query.limit(1);
        return { account, count: count ?? 0, error };
      })
    );

    const columnMissing = results.some((r) => r.error?.message.includes('smtp_account'));
    if (columnMissing) {
      if (accounts.length > 1) throw new SmtpAccountColumnMissingError();
      // Single account: every SENT log belongs to it
      const { count } = await client
        .from('email_dispatch_logs')
        .select('id', { count: 'exact' })
        .eq('status', 'SENT')
        .gte('sent_at', sinceIso)
        .limit(1);
      counts.set(primaryAccount, count ?? 0);
      return counts;
    }

    for (const r of results) {
      if (r.error) throw new Error(`Failed to count sends for ${r.account}: ${r.error.message}`);
      counts.set(r.account, r.count);
    }
    return counts;
  }

  const local = readLocalDb();
  const sinceMs = new Date(sinceIso).getTime();
  for (const job of local.email_dispatch_logs || []) {
    if (job.status !== 'SENT' || !job.sent_at || new Date(job.sent_at).getTime() < sinceMs) continue;
    const account = job.smtp_account || primaryAccount;
    if (counts.has(account)) counts.set(account, (counts.get(account) || 0) + 1);
  }
  return counts;
}

/**
 * Latest successful send per order_id from the dispatch log: which account sent it (null = sent before
 * per-account tracking, i.e. by the primary account) and when.
 */
export async function getLatestSentLogs(
  orderIds: string[]
): Promise<Map<string, { smtp_account: string | null; sent_at: string | null }>> {
  const latest = new Map<string, { smtp_account: string | null; sent_at: string | null }>();
  const keep = (row: { order_id: string; smtp_account?: string | null; sent_at?: string | null }) => {
    const prev = latest.get(row.order_id);
    if (!prev || (row.sent_at || '') > (prev.sent_at || '')) {
      latest.set(row.order_id, { smtp_account: row.smtp_account || null, sent_at: row.sent_at || null });
    }
  };
  const unique = Array.from(new Set(orderIds));
  if (unique.length === 0) return latest;

  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    const chunkSize = 150;
    for (let i = 0; i < unique.length; i += chunkSize) {
      const { data, error } = await client
        .from('email_dispatch_logs')
        .select('order_id, smtp_account, sent_at')
        .eq('status', 'SENT')
        .in('order_id', unique.slice(i, i + chunkSize));
      if (error) throw new Error(`Failed to read email senders: ${error.message}`);
      (data || []).forEach(keep);
    }
    return latest;
  }

  const wanted = new Set(unique);
  for (const job of readLocalDb().email_dispatch_logs || []) {
    if (job.status === 'SENT' && wanted.has(job.order_id)) keep(job);
  }
  return latest;
}

/** Jobs currently mid-send; they will consume sender quota but aren't SENT yet */
export async function countProcessingEmailJobs(): Promise<number> {
  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    const { count, error } = await client
      .from('email_dispatch_logs')
      .select('id', { count: 'exact' })
      .eq('status', 'PROCESSING')
      .limit(1);
    if (error) throw new Error(`Failed to count in-flight email jobs: ${error.message}`);
    return count ?? 0;
  }
  return (readLocalDb().email_dispatch_logs || []).filter((j) => j.status === 'PROCESSING').length;
}

/**
 * Park every not-yet-sent job in a batch as DEFERRED (all sender accounts are at their daily limit).
 * The attendee records stay Pending, so "Send All Pending" picks them up once quota frees.
 */
export async function deferQueuedEmailJobs(batchId: string, reason: string): Promise<number> {
  const nowIso = new Date().toISOString();
  const payload = { status: 'DEFERRED', error_message: reason, next_retry_at: null, updated_at: nowIso };
  const client = getSupabaseClient();

  if (isUsingSupabase() && client) {
    const { data, error } = await client
      .from('email_dispatch_logs')
      .update(payload)
      .eq('batch_id', batchId)
      .in('status', ['QUEUED', 'RETRYING'])
      .select('id');
    if (error) {
      console.error(`deferQueuedEmailJobs ${batchId} failed: ${error.message}`);
      return 0;
    }
    return data?.length ?? 0;
  }

  const local = readLocalDb();
  let deferred = 0;
  for (const job of local.email_dispatch_logs || []) {
    if (job.batch_id === batchId && (job.status === 'QUEUED' || job.status === 'RETRYING')) {
      Object.assign(job, payload);
      deferred++;
    }
  }
  if (deferred > 0) writeLocalDb(local);
  return deferred;
}

export async function resetStaleProcessingJobs(staleMinutes = 2): Promise<number> {
  const cutoffIso = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();
  const client = getSupabaseClient();
  let recovered = 0;

  if (isUsingSupabase() && client) {
    try {
      const { data, error } = await client
        .from('email_dispatch_logs')
        .update({
          status: 'RETRYING',
          next_retry_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          error_message: 'Worker execution timeout, auto-recovered for retry',
        })
        .eq('status', 'PROCESSING')
        .lt('updated_at', cutoffIso)
        .select('id');

      if (!error && data) recovered += data.length;
    } catch (err) {
      console.warn('Supabase resetStaleProcessingJobs fallback local:', err);
    }
  }

  const local = readLocalDb();
  if (local.email_dispatch_logs) {
    const cutoffMs = Date.now() - staleMinutes * 60 * 1000;
    for (const job of local.email_dispatch_logs) {
      if (job.status === 'PROCESSING' && new Date(job.updated_at || job.created_at).getTime() < cutoffMs) {
        job.status = 'RETRYING';
        job.next_retry_at = new Date().toISOString();
        job.updated_at = new Date().toISOString();
        job.error_message = 'Worker execution timeout, auto-recovered for retry';
        recovered++;
      }
    }
    if (recovered > 0) writeLocalDb(local);
  }

  return recovered;
}

