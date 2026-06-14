// Shared "next birthday" math. Used by the Discord `/birthday get` command,
// the web /birthdays page (via bot-bridge.formatNextBirthday), and the
// background reminder scheduler. All three previously computed the
// next-occurrence date independently — this consolidates the logic so any
// stored UTC time-of-day stays consistent across surfaces.

export interface NextBirthdayInfo {
  // Next occurrence of the birthday with UTC time preserved from the original.
  nextDate: Date;
  // Whole days until that next occurrence, rounded toward +∞ (matches the
  // historical bot behaviour).
  daysUntil: number;
  // Most recent past birthday (today or earlier).
  lastDate: Date;
  // Calendar age based on `lastDate`. Returned for callers that need it.
  yearsAgo: number;
}

// `now` overridable for tests. Comparisons and arithmetic stay in UTC so the
// scheduler running on any host produces the same answer as a /birthday get.
export function getNextBirthdayInfo(birthdayISO: string, now: Date = new Date()): NextBirthdayInfo | null {
  const birthday = new Date(birthdayISO);
  if (Number.isNaN(birthday.getTime())) return null;

  const month = birthday.getUTCMonth();
  const day = birthday.getUTCDate();
  const hour = birthday.getUTCHours();
  const minute = birthday.getUTCMinutes();

  // Day-only boundary used for "is the next one this year or next year?".
  const today = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  ));

  let nextDate = new Date(Date.UTC(now.getUTCFullYear(), month, day, hour, minute));
  const nextDay = new Date(Date.UTC(
    nextDate.getUTCFullYear(),
    nextDate.getUTCMonth(),
    nextDate.getUTCDate(),
  ));
  if (nextDay.getTime() < today.getTime()) {
    nextDate = new Date(Date.UTC(now.getUTCFullYear() + 1, month, day, hour, minute));
  }

  let lastDate = new Date(Date.UTC(now.getUTCFullYear(), month, day, hour, minute));
  if (lastDate.getTime() > now.getTime()) {
    lastDate = new Date(Date.UTC(now.getUTCFullYear() - 1, month, day, hour, minute));
  }

  const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / 86_400_000);
  const yearsAgo = lastDate.getUTCFullYear() - birthday.getUTCFullYear();

  return {
    nextDate,
    daysUntil,
    lastDate,
    yearsAgo,
  };
}
