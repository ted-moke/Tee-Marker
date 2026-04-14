export interface Preferences {
  scheduleIds: string[]
  specificDates: string[]
  timeRange: { start: string; end: string }
  players: number
  checkIntervalMinutes: number
  forecastOffsetHours: number
  discordWebhookUrl: string
  weatherThresholds: WeatherThresholds
  reservationReminders: boolean
  weeklyDigest: boolean
}

export type TeeTimeSource = 'foreup' | 'ezlinks'

export interface Reservation {
  id: string
  source: TeeTimeSource
  scheduleId: string
  scheduleName: string
  date: string      // YYYY-MM-DD
  time: string      // raw time string from the provider
  players: number
  status: string
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

export interface CheckRecord {
  id?: string
  timestamp: Date
  schedulesChecked: string[]
  timesFound: number
  notified: number
  errors: string[]
}

export interface NotifiedTime {
  id?: string
  scheduleId: string
  date: string
  time: string
  notifiedAt: Date
}

export interface TeeTimeWeather {
  temperatureF: number | null
  precipitationProbabilityPct: number | null
  windSpeedMph: number | null
  weatherCode: number | null
  weatherLabel: string
}

export interface DailyForecastWeather {
  temperatureHighF: number | null
  temperatureLowF: number | null
  precipitationProbabilityPct: number | null
  windSpeedMph: number | null
  weatherCode: number | null
  weatherLabel: string
}

export interface DailyWeatherSummaryDay {
  date: string
  weather: DailyForecastWeather | null
}

export interface TeeTime {
  id: string
  source: TeeTimeSource
  scheduleId: string
  scheduleName?: string
  date: string
  time: string
  availableSpots: number
  price?: number
  weather?: TeeTimeWeather
}

export interface SchedulerStatus {
  isRunning: boolean
  lastCheck: Date | null
  nextCheck: Date | null
  lastCheckResult: CheckRecord | null
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export class AppError extends Error {
  public statusCode: number
  constructor(message: string, statusCode: number = 500) {
    super(message)
    this.statusCode = statusCode
    Error.captureStackTrace(this, this.constructor)
  }
}
