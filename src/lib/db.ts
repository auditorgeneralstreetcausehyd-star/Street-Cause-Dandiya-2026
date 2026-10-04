import { createClient, SupabaseClient } from '@supabase/supabase-js';
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
  navratriPassBgUrl: 'https://res.cloudinary.com/dhrj3rpg8/image/upload/v1789971984/EVENT_PASS.png',
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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url.trim() === '' || key.trim() === '') {
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
    const key = overrideKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
    donationTransactions: number;
    totalDonationAmount: number;
    divisionMap: Map<string, {
      passTransactions: number;
      totalPasses: number;
      donationTransactions: number;
      totalDonationAmount: number;
    }>;
  }>();

  for (let h = 0; h < 24; h++) {
    hourMap.set(h, {
      passTransactions: 0,
      totalPasses: 0,
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
        donationTransactions: 0,
        totalDonationAmount: 0,
      });
    }
    const divEntry = hData.divisionMap.get(divName)!;

    if (r.record_type === 'PASS') {
      const qty = Number(r.item_quantity) || 1;
      hData.passTransactions++;
      hData.totalPasses += qty;
      divEntry.passTransactions++;
      divEntry.totalPasses += qty;
    } else if (r.record_type === 'DONATION') {
      const amt = Number(r.total_payment_amount) || Number(r.item_payment_amount) || 0;
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
        donationTransactions: divD.donationTransactions,
        totalDonationAmount: divD.totalDonationAmount,
        totalRevenue: divD.totalDonationAmount,
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
      donationTransactions: dData.donationTransactions,
      totalDonationAmount: dData.totalDonationAmount,
      totalRevenue: dData.totalDonationAmount,
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
      donationTransactions: number;
      totalDonationAmount: number;
      divisionMap: Map<
        string,
        {
          passTransactions: number;
          totalPasses: number;
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
        donationTransactions: 0,
        totalDonationAmount: 0,
      });
    }
    const divEntry = day.divisionMap.get(divName)!;

    if (r.record_type === 'PASS') {
      const qty = Number(r.item_quantity) || 1;
      day.passTransactions++;
      day.totalPasses += qty;
      divEntry.passTransactions++;
      divEntry.totalPasses += qty;
    } else if (r.record_type === 'DONATION') {
      const amt = Number(r.total_payment_amount) || Number(r.item_payment_amount) || 0;
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
        donationTransactions: dData.donationTransactions,
        totalDonationAmount: dData.totalDonationAmount,
        totalRevenue: dData.totalDonationAmount,
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
      donationTransactions: data.donationTransactions,
      totalDonationAmount: data.totalDonationAmount,
      totalRevenue: data.totalDonationAmount,
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
      item.passTransactions++;
      item.totalPasses += qty;
      vol.passes += qty;
      vol.passTransactions++;
      dayItem.passes += qty;
    } else if (r.record_type === 'DONATION') {
      const amt = Number(r.total_payment_amount) || Number(r.item_payment_amount) || 0;
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
      donationTransactions: data.donationTransactions,
      totalDonationAmount: data.totalDonationAmount,
      totalRevenue: data.totalDonationAmount,
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

      const [records, { data: latestBatches }] = await Promise.all([
        fetchSupabaseRecords(client, eventId),
        batchQuery.limit(1),
      ]);

      const passes = records.filter((r) => r.record_type === 'PASS');
      const donations = records.filter((r) => r.record_type === 'DONATION');

      const totalCapturedPasses = passes.reduce((acc, curr) => acc + (Number(curr.item_quantity) || 1), 0);
      const passTransactions = passes.length;
      const capturedDonations = donations.length;
      const totalDonationAmount = donations.reduce((acc, curr) => acc + (Number(curr.total_payment_amount) || Number(curr.item_payment_amount) || 0), 0);

      const divisionStats = computeDivisionStats(records);
      const dayWiseStats = computeDayWiseStats(records);
      const hourlyStats = computeHourlyStats(records);

      return {
        totalCapturedPasses,
        passTransactions,
        capturedDonations,
        totalDonationAmount,
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
  let records = local.records;
  let batches = local.batches;

  if (eventId && eventId !== 'all') {
    records = records.filter((r) => (r.event_id || 'garba_groove') === eventId);
    batches = batches.filter((b) => (b.event_id || 'garba_groove') === eventId);
  }

  const passes = records.filter((r) => r.record_type === 'PASS');
  const donations = records.filter((r) => r.record_type === 'DONATION');

  const totalCapturedPasses = passes.reduce((acc, curr) => acc + (Number(curr.item_quantity) || 1), 0);
  const passTransactions = passes.length;
  const capturedDonations = donations.length;
  const totalDonationAmount = donations.reduce((acc, curr) => acc + (Number(curr.total_payment_amount) || Number(curr.item_payment_amount) || 0), 0);

  const divisionStats = computeDivisionStats(records);
  const dayWiseStats = computeDayWiseStats(records);
  const hourlyStats = computeHourlyStats(records);

  return {
    totalCapturedPasses,
    passTransactions,
    capturedDonations,
    totalDonationAmount,
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
  limit?: number;
  offset?: number;
}): Promise<{ records: EventRecord[]; total: number }> {
  const { type, eventId, search, division, date, hour, limit = 50, offset = 0 } = params;

  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    try {
      let records = await fetchSupabaseRecords(client, eventId);

      if (type) {
        records = records.filter((r) => r.record_type === type);
      }
      if (division && division !== 'all') {
        records = records.filter((r) => r.divisions === division);
      }
      if (date && date !== 'all') {
        records = records.filter((r) => parseRecordDateTime(r.payment_date || r.created_at).isoDate === date);
      }
      if (hour !== undefined && hour !== null && hour !== 'all' && String(hour).trim() !== '') {
        const targetH = Number(hour);
        records = records.filter((r) => parseRecordDateTime(r.payment_date || r.created_at).hour === targetH);
      }
      if (search && search.trim()) {
        const s = search.trim().toLowerCase();
        records = records.filter(
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
      const records = await fetchSupabaseRecords(client);
      const matched = records.filter((r) => orderIds.includes(r.order_id));
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
    try {
      await Promise.allSettled([
        client.from('garba_groove_passes').update(updatePayload).eq('order_id', orderId),
        client.from('garba_groove_donations').update(updatePayload).eq('order_id', orderId),
        client.from('navratri_utsav_passes').update(updatePayload).eq('order_id', orderId),
        client.from('navratri_utsav_donations').update(updatePayload).eq('order_id', orderId),
      ]);
    } catch (err) {
      console.warn('Supabase updateRecordEmailStatus error:', err);
    }
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

// Get single record by code or order_id
export async function getRecordByCode(code: string): Promise<EventRecord | null> {
  if (!code || !code.trim()) return null;
  const trimmed = code.trim();

  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    try {
      const records = await fetchSupabaseRecords(client);
      const found = records.find(
        (r) => r.order_id?.trim() === trimmed || r.code?.trim() === trimmed
      );
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
      const records = await fetchSupabaseRecords(client);
      const target = records.find(
        (r) => r.order_id?.trim() === trimmed || r.code?.trim() === trimmed
      );

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
