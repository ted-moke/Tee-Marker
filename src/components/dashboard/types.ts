export interface SchedulerStatus {
  isRunning: boolean
  lastCheck: string | null
  nextCheck: string | null
  lastCheckResult: {
    timesFound: number
    notified: number
    errors: string[]
  } | null
}

export interface CheckRecord {
  id: string
  timestamp: string
  schedulesChecked: string[]
  timesFound: number
  notified: number
  errors: string[]
}

export interface Preferences {
  scheduleIds: string[]
  daysOfWeek: number[]
  players: number
}

export interface TeeTime {
  id: string
  scheduleId: string
  date: string
  time: string
  availableSpots: number
  price?: number
}

export type CalendarData = Record<string, Record<string, TeeTime | null>>
