/**
 * Canonical form of an email address as typed by a buyer: every whitespace character removed
 * (including spaces inside, e.g. "name @gmail.com") and lowercased ("Name@Gmail.com" -> "name@gmail.com").
 */
export function normalizeEmail(email?: string | null): string {
  return (email || '').replace(/\s+/g, '').toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
