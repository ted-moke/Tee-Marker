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
  weatherThresholds: WeatherThresholds
}

export interface TeeTime {
  id: string
  scheduleId: string
  date: string
  time: string
  availableSpots: number
  price?: number
  weather?: TeeTimeWeather
}

export interface TeeTimeWeather {
  temperatureF: number | null
  precipitationProbabilityPct: number | null
  windSpeedMph: number | null
  weatherCode: number | null
  weatherLabel: string
}

export interface WeatherThresholds {
  rainGoodMax: number
  rainBadMin: number
  windGoodMax: number
  windMidMax: number
  tempBadLow: number
  tempGoodMin: number
  tempGoodMax: number
  tempBadHigh: number
}

export const DEFAULT_WEATHER_THRESHOLDS: WeatherThresholds = {
  rainGoodMax: 20,
  rainBadMin: 60,
  windGoodMax: 5,
  windMidMax: 12,
  tempBadLow: 45,
  tempGoodMin: 60,
  tempGoodMax: 80,
  tempBadHigh: 90,
}

export interface CourseDaySummary {
  earliest: TeeTime | null
  additionalCount: number
  allTimes: TeeTime[]
}

export type CalendarData = Record<string, Record<string, CourseDaySummary>>
