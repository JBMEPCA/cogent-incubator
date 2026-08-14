// Agents work office hours: 07:00 to 20:00 UK time.
//
// The check is against UK wall clock, not UTC, so it stays correct through the
// BST/GMT switch without touching the cron. The GitHub schedule is deliberately
// a little wider than the window and this gate trims it to the exact hours.
const UK = "Europe/London";

export const START_HOUR = 7;
export const END_HOUR = 20;

export function ukHour(date = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: UK, hour: "numeric", hour12: false }).format(date)
  );
}

export function withinOperatingHours(date = new Date()) {
  const h = ukHour(date);
  return h >= START_HOUR && h < END_HOUR;
}

export function operatingHoursLabel() {
  return `${START_HOUR}:00 to ${END_HOUR}:00 UK`;
}
