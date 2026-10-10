// Domain typos buyers made at checkout (seen in bounces: gamil.com, gmail.con, gemail.com ...).
// Explicit list only: a fuzzy match could turn a real domain (gmx.com, college domains) into a wrong one.
const DOMAIN_TYPOS: Record<string, string> = {
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmali.com': 'gmail.com',
  'gmil.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmaul.com': 'gmail.com',
  'gmaik.com': 'gmail.com',
  'gmsil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gemail.com': 'gmail.com',
  'gamail.com': 'gmail.com',
  'gimail.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.om': 'gmail.com',
  'gmail.comm': 'gmail.com',
  'gmail.cpm': 'gmail.com',
  'gmail.cim': 'gmail.com',
  'gmail.vom': 'gmail.com',
  'gmail.xom': 'gmail.com',
  'gmail.c': 'gmail.com',
  'gmail': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yhoo.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outlook.con': 'outlook.com',
};

/**
 * Canonical form of an email address as typed by a buyer: every whitespace character removed
 * (including spaces inside, e.g. "name @gmail.com"), lowercased ("Name@Gmail.com" -> "name@gmail.com"),
 * and known domain typos corrected ("name@gamil.com" -> "name@gmail.com").
 */
export function normalizeEmail(email?: string | null): string {
  const cleaned = (email || '').replace(/\s+/g, '').toLowerCase();
  const at = cleaned.lastIndexOf('@');
  if (at === -1) return cleaned;
  const domain = cleaned.slice(at + 1);
  return cleaned.slice(0, at + 1) + (DOMAIN_TYPOS[domain] || domain);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
