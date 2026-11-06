// 'HH:MM' (24h) -> 'h:MM AM/PM'. Leaves already-formatted/empty values as is.
export const fmt12 = (t?: string | null): string => {
  if (!t) return '';
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(t).trim());
  if (!m) return String(t);
  let h = parseInt(m[1], 10);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ap}`;
};
// sort key for appointments; leads without a date go last
export const apptKey = (l: any): string =>
  l?.next_followup_date ? `${String(l.next_followup_date).slice(0, 10)} ${(l.next_followup_time || '00:00').padStart(5, '0')}` : '9999-99-99';
