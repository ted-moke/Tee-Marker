export function fmt(ts: string | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleString()
}

function toYmd(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getDateRange(daysAhead: number): string[] {
  const out: string[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i <= daysAhead; i += 1) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    out.push(toYmd(d))
  }

  return out
}

export function parseTimeToMinutes(time: string): number {
  const clean = time.trim()
  const amPm = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)

  if (amPm) {
    let hours = parseInt(amPm[1]!, 10)
    const minutes = parseInt(amPm[2]!, 10)
    const meridiem = amPm[3]!.toUpperCase()
    if (meridiem === 'PM' && hours !== 12) hours += 12
    if (meridiem === 'AM' && hours === 12) hours = 0
    return hours * 60 + minutes
  }

  const twentyFourHour = clean.match(/^(\d{1,2}):(\d{2})$/)
  if (twentyFourHour) {
    const hours = parseInt(twentyFourHour[1]!, 10)
    const minutes = parseInt(twentyFourHour[2]!, 10)
    return hours * 60 + minutes
  }

  return Number.MAX_SAFE_INTEGER
}

export function weekdayLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' })
}

export function dateLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
