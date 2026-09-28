// Timezone helpers so all "day" and "time-of-day" logic runs in the venue's
// local time (e.g. Africa/Lagos, UTC+1) instead of the UTC the server runs in.
// Uses Intl for DST-correct offsets — no dependency.

export const DEFAULT_TZ = "Africa/Lagos";

// Offset (ms) of `tz` from UTC at the given instant.
function offsetMs(tz: string, at: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(new Date(at))) p[part.type] = part.value;
  const hour = p.hour === "24" ? 0 : Number(p.hour);
  const asUTC = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), hour, Number(p.minute), Number(p.second));
  return asUTC - at;
}

// Venue wall-clock "now": minutes since midnight + the venue date (YYYY-MM-DD).
export function venueNow(tz: string, at: number = Date.now()): { minutes: number; date: string } {
  const local = new Date(at + offsetMs(tz, at)); // UTC fields now read as venue wall time
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const date = local.toISOString().slice(0, 10);
  return { minutes, date };
}

// The venue-local date string (YYYY-MM-DD) for a timestamp.
export function venueDate(tz: string, at: number): string {
  return venueNow(tz, at).date;
}

// [start, end) epoch range for a venue-local day "YYYY-MM-DD".
export function venueDayRange(tz: string, date: string): [number, number] {
  const [y, m, d] = date.split("-").map(Number);
  const g1 = Date.UTC(y, m - 1, d);
  const start = g1 - offsetMs(tz, g1);
  const g2 = Date.UTC(y, m - 1, d + 1);
  const end = g2 - offsetMs(tz, g2);
  return [start, end];
}

// Epoch for a minutes-of-day on the venue day that `at` falls in.
export function venueTimeEpoch(tz: string, minutes: number, at: number = Date.now()): number {
  const { date } = venueNow(tz, at);
  return venueDayRange(tz, date)[0] + minutes * 60000;
}

// "6:00 AM" style label from minutes-of-day.
export function minutesLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}
