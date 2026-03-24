function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toDateStringInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function buildDateKeysInTimeZone(startDate: Date, dayCount: number, timeZone: string): string[] {
  return Array.from({ length: dayCount }, (_unused, offset) => toDateStringInTimeZone(addDays(startDate, offset), timeZone))
}
