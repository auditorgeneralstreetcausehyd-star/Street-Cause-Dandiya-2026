import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import {
  DashboardStats,
  DayDivisionStat,
  DayWiseStat,
  DivisionStats,
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

// Local database file path
const DATA_DIR = path.join(process.cwd(), 'data');
const LOCAL_DB_PATH = path.join(DATA_DIR, 'local_db.json');

interface LocalDatabase {
  batches: ImportBatch[];
  records: EventRecord[];
  errors: ImportError[];
  settings: SystemSettings;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readLocalDb(): LocalDatabase {
  ensureDataDir();
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    const initial: LocalDatabase = {
      batches: [],
      records: [],
      errors: [],
      settings: DEFAULT_SETTINGS,
    };
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const content = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    let modified = false;
    if (Array.isArray(parsed.batches)) {
      for (const b of parsed.batches) {
        if (!b.event_id) {
          b.event_id = 'garba_groove';
          b.event_name = 'Garba Groove 2026';
          modified = true;
        }
      }
    }
    if (Array.isArray(parsed.records)) {
      for (const r of parsed.records) {
        if (!r.event_id) {
          r.event_id = 'garba_groove';
          r.event_name = 'Garba Groove 2026';
          modified = true;
        }
      }
    }
    if (modified) {
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(parsed, null, 2), 'utf-8');
    }
    return parsed;
  } catch {
    return { batches: [], records: [], errors: [], settings: DEFAULT_SETTINGS };
  }
}

function writeLocalDb(data: LocalDatabase): void {
  ensureDataDir();
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
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

// Check existing order_ids for deduplication
export async function getExistingOrderIds(): Promise<Set<string>> {
  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    try {
      const { data, error } = await client.from('event_records').select('order_id');
      if (!error && data) {
        return new Set(data.map((r: { order_id: string }) => r.order_id));
      }
      console.warn('Supabase getExistingOrderIds failed, falling back to local store:', error?.message);
    } catch (err) {
      console.warn('Supabase query error:', err);
    }
  }

  const local = readLocalDb();
  return new Set(local.records.map((r) => r.order_id));
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

// Insert Event Records with duplicate avoidance
export async function insertEventRecords(records: EventRecord[]): Promise<{ inserted: number; skipped: number; errors: any[] }> {
  if (records.length === 0) return { inserted: 0, skipped: 0, errors: [] };

  const existingIds = await getExistingOrderIds();
  const toInsert = records.filter((r) => !existingIds.has(r.order_id));
  const skipped = records.length - toInsert.length;

  if (toInsert.length === 0) {
    return { inserted: 0, skipped, errors: [] };
  }

  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    try {
      // Batch in chunks of 100 for optimal Supabase performance
      const chunkSize = 100;
      let count = 0;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize).map(r => {
          const { attendance_status, checked_in_at, ...clean } = r;
          return clean;
        });
        const { error } = await client.from('event_records').insert(chunk);
        if (error) {
          console.error('Supabase batch insert error on chunk:', error.message);
          throw error;
        }
        count += chunk.length;
      }
      return { inserted: count, skipped, errors: [] };
    } catch (err) {
      console.warn('Supabase bulk insert failed, storing locally:', err);
    }
  }

  const local = readLocalDb();
  local.records.push(...toInsert);
  writeLocalDb(local);
  return { inserted: toInsert.length, skipped, errors: [] };
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseRecordDate(dateStr?: string): { isoDate: string; displayDate: string } {
  if (!dateStr || !dateStr.trim()) {
    return { isoDate: 'unknown', displayDate: 'Date Unspecified' };
  }
  const trimmed = dateStr.trim();

  // Pattern: DD/MM/YYYY or DD-MM-YYYY or DD/MM/YY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;

    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const displayDate = `${day} ${MONTH_NAMES[month - 1] || month} ${year}`;
    return { isoDate, displayDate };
  }

  // Pattern: YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const displayDate = `${day} ${MONTH_NAMES[month - 1] || month} ${year}`;
    return { isoDate, displayDate };
  }

  // Standard JS Date parsing
  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const displayDate = `${day} ${MONTH_NAMES[month - 1] || month} ${year}`;
      return { isoDate, displayDate };
    }
  } catch {}

  const simple = trimmed.split(' ')[0] || 'Unknown';
  return { isoDate: simple, displayDate: simple };
}

// Compute Overall Day-Wise & Day-Wise Division Statistics
export function computeDayWiseStats(records: EventRecord[]): DayWiseStat[] {
  const dayMap = new Map<
    string,
    {
      displayDate: string;
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
    const { isoDate, displayDate } = parseRecordDate(r.payment_date || r.created_at);
    if (!dayMap.has(isoDate)) {
      dayMap.set(isoDate, {
        displayDate,
        passTransactions: 0,
        totalPasses: 0,
        donationTransactions: 0,
        totalDonationAmount: 0,
        divisionMap: new Map(),
      });
    }

    const day = dayMap.get(isoDate)!;
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
      const amt = Number(r.item_payment_amount) || 0;
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
    });
  }

  return result.sort((a, b) => b.date.localeCompare(a.date));
}

// Compute Division Wise Statistics with Daily Trajectory
export function computeDivisionStats(records: EventRecord[]): DivisionStats[] {
  const map = new Map<
    string,
    {
      passTransactions: number;
      totalPasses: number;
      donationTransactions: number;
      totalDonationAmount: number;
      volunteers: Map<
        string,
        {
          name: string;
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
        volunteers: new Map(),
        dayTrend: new Map(),
      });
    }

    const item = map.get(divName)!;
    const volName = (r.referred_volunteer || '').trim() || 'Direct';
    const l2Name = (r.l2 || '').trim();

    if (!item.volunteers.has(volName)) {
      item.volunteers.set(volName, {
        name: volName,
        l2Set: new Set(),
        passes: 0,
        passTransactions: 0,
        donations: 0,
        donationTransactions: 0,
      });
    }
    const vol = item.volunteers.get(volName)!;
    if (l2Name && l2Name !== 'null' && l2Name !== 'undefined') {
      vol.l2Set.add(l2Name);
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
      const amt = Number(r.item_payment_amount) || 0;
      item.donationTransactions++;
      item.totalDonationAmount += amt;
      vol.donations += amt;
      vol.donationTransactions++;
      dayItem.donations += amt;
    }
  }

  const result: DivisionStats[] = [];
  for (const [division, data] of map.entries()) {
    const allVolunteers: VolunteerStat[] = Array.from(data.volunteers.values())
      .map((v) => ({
        name: v.name,
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
      volunteersCount: data.volunteers.size,
      topVolunteers,
      allVolunteers,
      dayWiseTrend,
    });
  }

  // Sort by total passes descending then donation amount
  return result.sort((a, b) => b.totalPasses - a.totalPasses || b.totalDonationAmount - a.totalDonationAmount);
}

// Get Dashboard Statistics with Event Scope, Division Breakdown & Day-Wise Analytics
export async function getDashboardStats(eventId?: string): Promise<DashboardStats> {
  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    try {
      let query = client.from('event_records').select('*');
      let batchQuery = client.from('import_batches').select('*').order('created_at', { ascending: false });

      if (eventId && eventId !== 'all') {
        query = query.eq('event_id', eventId);
        batchQuery = batchQuery.eq('event_id', eventId);
      }

      const [{ data: recordsData }, { data: latestBatches }] = await Promise.all([
        query,
        batchQuery.limit(1),
      ]);

      const records = (recordsData || []) as EventRecord[];
      const passes = records.filter((r) => r.record_type === 'PASS');
      const donations = records.filter((r) => r.record_type === 'DONATION');

      const totalCapturedPasses = passes.reduce((acc, curr) => acc + (Number(curr.item_quantity) || 1), 0);
      const passTransactions = passes.length;
      const capturedDonations = donations.length;
      const totalDonationAmount = donations.reduce((acc, curr) => acc + (Number(curr.item_payment_amount) || 0), 0);

      const divisionStats = computeDivisionStats(records);
      const dayWiseStats = computeDayWiseStats(records);

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
  const totalDonationAmount = donations.reduce((acc, curr) => acc + (Number(curr.item_payment_amount) || 0), 0);

  const divisionStats = computeDivisionStats(records);
  const dayWiseStats = computeDayWiseStats(records);

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
  };
}

// Get paginated / filtered records
export async function getRecords(params: {
  type?: 'PASS' | 'DONATION';
  eventId?: string;
  search?: string;
  division?: string;
  limit?: number;
  offset?: number;
}): Promise<{ records: EventRecord[]; total: number }> {
  const { type, eventId, search, division, limit = 50, offset = 0 } = params;

  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    try {
      let query = client.from('event_records').select('*', { count: 'exact' });
      if (type) query = query.eq('record_type', type);
      if (eventId && eventId !== 'all') query = query.eq('event_id', eventId);
      if (division && division !== 'all') query = query.eq('divisions', division);
      if (search && search.trim()) {
        const s = search.trim();
        query = query.or(`order_id.ilike.%${s}%,name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%,payment_id.ilike.%${s}%,divisions.ilike.%${s}%,referred_volunteer.ilike.%${s}%`);
      }
      query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

      const { data, count, error } = await query;
      if (!error && data) {
        return { records: data as EventRecord[], total: count || data.length };
      }
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

  let results: EventRecord[] = [];

  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    try {
      const { data, error } = await client.from('event_records').select('*').in('order_id', orderIds);
      if (!error && data) {
        results = data as EventRecord[];
      }
    } catch (err) {
      console.warn('Supabase getRecordsByOrderIds error, fallback local:', err);
    }
  }

  if (results.length === 0) {
    const local = readLocalDb();
    results = local.records.filter((r) => orderIds.includes(r.order_id));
  }

  return results;
}

// Update Email Status
export async function updateRecordEmailStatus(orderId: string, status: 'Pending' | 'Sent' | 'Failed', sentAt: string | null = null): Promise<void> {
  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    try {
      await client.from('event_records').update({ email_status: status, email_sent_at: sentAt }).eq('order_id', orderId);
    } catch (err) {
      console.warn('Supabase updateRecordEmailStatus error:', err);
    }
  }

  const local = readLocalDb();
  const idx = local.records.findIndex((r) => r.order_id === orderId);
  if (idx !== -1) {
    local.records[idx] = { ...local.records[idx], email_status: status, email_sent_at: sentAt };
    writeLocalDb(local);
  }
}

// Get All Batches with Event Filter
export async function getImportBatches(eventId?: string): Promise<ImportBatch[]> {
  const client = getSupabaseClient();
  if (isUsingSupabase() && client) {
    try {
      let query = client.from('import_batches').select('*').order('created_at', { ascending: false });
      if (eventId && eventId !== 'all') {
        query = query.eq('event_id', eventId);
      }
      const { data, error } = await query;
      if (!error && data) return data as ImportBatch[];
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
  // Sync environment variables into settings if present
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
      // 1. Try order_id match
      const { data: byOrder, error: errOrder } = await client
        .from('event_records')
        .select('*')
        .eq('order_id', trimmed)
        .limit(1);

      if (!errOrder && byOrder && byOrder.length > 0) {
        return byOrder[0] as EventRecord;
      }

      // 2. Try code match
      const { data: byCode, error: errCode } = await client
        .from('event_records')
        .select('*')
        .eq('code', trimmed)
        .limit(1);

      if (!errCode && byCode && byCode.length > 0) {
        return byCode[0] as EventRecord;
      }
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
      let targetId: string | null = null;

      // Find by order_id
      const { data: byOrder } = await client
        .from('event_records')
        .select('id')
        .eq('order_id', trimmed)
        .limit(1);

      if (byOrder && byOrder.length > 0) {
        targetId = byOrder[0].id;
      } else {
        // Find by code
        const { data: byCode } = await client
          .from('event_records')
          .select('id')
          .eq('code', trimmed)
          .limit(1);

        if (byCode && byCode.length > 0) {
          targetId = byCode[0].id;
        }
      }

      if (targetId) {
        const { data, error } = await client
          .from('event_records')
          .update({ attendance_status: status, checked_in_at: checkedInAt })
          .eq('id', targetId)
          .select()
          .single();

        if (!error && data) {
          return { success: true, record: data as EventRecord };
        }
      }
    } catch (err: any) {
      console.warn('Supabase updateAttendanceStatus error, updating locally:', err?.message);
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

