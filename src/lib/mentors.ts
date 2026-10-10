import { DayDivisionStat } from './types';

/**
 * Division -> mentor mapping. Division names are matched case-insensitively.
 * A division can switch mentor on a date: `from` (YYYY-MM-DD, inclusive) applies to sales on or after it.
 * GNITS: Tejasri up to 5 Oct, Dilip from 6 Oct.
 */
const MENTOR_RULES: { mentor: string; division: string; from?: string; until?: string }[] = [
  { mentor: 'Manjunath', division: 'VNRVJIET' },
  { mentor: 'Manjunath', division: 'GRIET' },
  { mentor: 'Manjunath', division: 'VBIT' },
  { mentor: 'Manjunath', division: 'ANURAG UNIVERSITY' },
  { mentor: 'Dilip', division: 'IARE' },
  { mentor: 'Dilip', division: 'GNI' },
  { mentor: 'Dilip', division: 'WP' },
  { mentor: 'Dilip', division: 'GNITS', from: '2026-10-06' },
  { mentor: 'Dhanush', division: 'CMRCET' },
  { mentor: 'Dhanush', division: 'MECS' },
  { mentor: 'Tejasri', division: 'CMRIT' },
  { mentor: 'Tejasri', division: 'MRDU' },
  { mentor: 'Tejasri', division: 'GNITS', until: '2026-10-05' },
  { mentor: 'Hasini', division: 'FRANCIS' },
  { mentor: 'Hasini', division: 'VJIT' },
  { mentor: 'Hasini', division: 'STANLEY' },
  { mentor: 'Hasini', division: 'SCET' },
  { mentor: 'Hasini', division: 'BHAVANS' },
];

export const MENTOR_NAMES = ['Manjunath', 'Dilip', 'Dhanush', 'Tejasri', 'Hasini'];
export const UNASSIGNED_MENTOR = 'Unassigned';

const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ');

/** Mentor for a division's sale on isoDate (YYYY-MM-DD), or null if no rule covers it */
export function mentorFor(division: string, isoDate: string): { mentor: string; label: string } | null {
  const d = norm(division);
  for (const rule of MENTOR_RULES) {
    if (rule.division !== d) continue;
    const dated = Boolean(rule.from || rule.until);
    // A date-split division needs a real date; unknown dates fall through to Unassigned
    if (dated && !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) continue;
    if (rule.from && isoDate < rule.from) continue;
    if (rule.until && isoDate > rule.until) continue;
    const label = rule.from
      ? `${division} (from ${fmtDay(rule.from)})`
      : rule.until
      ? `${division} (till ${fmtDay(rule.until)})`
      : division;
    return { mentor: rule.mentor, label };
  }
  return null;
}

function fmtDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]}`;
}

export interface MentorDivisionStat {
  label: string;
  passes: number;
  passTransactions: number;
  passAmount: number;
  donationTransactions: number;
  donationAmount: number;
  revenue: number;
}

export interface MentorStat extends Omit<MentorDivisionStat, 'label'> {
  mentor: string;
  divisions: MentorDivisionStat[];
}

/** Roll per-day division figures up to mentors (date-aware, so split divisions land with the right mentor) */
export function computeMentorStats(days: { date: string; divisionStats: DayDivisionStat[] }[]): MentorStat[] {
  const byMentor = new Map<string, Map<string, MentorDivisionStat>>();
  for (const name of MENTOR_NAMES) byMentor.set(name, new Map());

  for (const day of days) {
    for (const ds of day.divisionStats) {
      const assigned = mentorFor(ds.division, day.date);
      const mentor = assigned?.mentor || UNASSIGNED_MENTOR;
      const label = assigned?.label || ds.division;
      if (!byMentor.has(mentor)) byMentor.set(mentor, new Map());
      const divs = byMentor.get(mentor)!;
      const entry =
        divs.get(label) ||
        { label, passes: 0, passTransactions: 0, passAmount: 0, donationTransactions: 0, donationAmount: 0, revenue: 0 };
      entry.passes += ds.totalPasses;
      entry.passTransactions += ds.passTransactions;
      entry.passAmount += ds.totalPassAmount || 0;
      entry.donationTransactions += ds.donationTransactions;
      entry.donationAmount += ds.totalDonationAmount;
      entry.revenue += ds.totalRevenue ?? (ds.totalPassAmount || 0) + ds.totalDonationAmount;
      divs.set(label, entry);
    }
  }

  const result: MentorStat[] = [];
  for (const [mentor, divs] of byMentor) {
    const divisions = Array.from(divs.values()).sort((a, b) => b.revenue - a.revenue);
    if (mentor === UNASSIGNED_MENTOR && divisions.length === 0) continue;
    const sum = (k: keyof Omit<MentorDivisionStat, 'label'>) => divisions.reduce((acc, d) => acc + d[k], 0);
    result.push({
      mentor,
      divisions,
      passes: sum('passes'),
      passTransactions: sum('passTransactions'),
      passAmount: sum('passAmount'),
      donationTransactions: sum('donationTransactions'),
      donationAmount: sum('donationAmount'),
      revenue: sum('revenue'),
    });
  }
  // Mentors by amount raised; Unassigned always last
  return result.sort((a, b) =>
    a.mentor === UNASSIGNED_MENTOR ? 1 : b.mentor === UNASSIGNED_MENTOR ? -1 : b.revenue - a.revenue
  );
}
