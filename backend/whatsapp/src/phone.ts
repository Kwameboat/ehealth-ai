export function normalizePhone(raw: string): string {
  let digits = String(raw || '')
    .replace(/@.*$/, '')
    .replace(/\D/g, '');

  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 10) {
    digits = `233${digits.slice(1)}`;
  }
  if (!digits.startsWith('233') && digits.length === 9) {
    digits = `233${digits}`;
  }
  return digits;
}

export function phonesMatch(a: string, b: string): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.endsWith(nb) || nb.endsWith(na)) return true;
  return false;
}
