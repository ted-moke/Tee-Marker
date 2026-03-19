export const FRANCIS_BYRNE_SCHEDULES: Record<string, string> = {
  '11078': 'Francis Byrne',
  '11075': 'Hendricks Field',
  '11077': 'Weequahic',
}

export const FOREUP_COURSE_BY_SCHEDULE: Record<string, string> = {
  '11078': '22528', // Francis Byrne
  '11077': '22527', // Weequahic
  '11075': '22526', // Hendricks Field
}

export interface CourseLocation {
  latitude: number
  longitude: number
  timezone: string
}

export const COURSE_LOCATION_BY_SCHEDULE: Record<string, CourseLocation> = {
  // Newark, NJ municipal courses
  '11078': { latitude: 40.7253, longitude: -74.2283, timezone: 'America/New_York' }, // Francis Byrne
  '11077': { latitude: 40.7083, longitude: -74.2218, timezone: 'America/New_York' }, // Weequahic
  '11075': { latitude: 40.7197, longitude: -74.1934, timezone: 'America/New_York' }, // Hendricks Field
}

export const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast'
export const WEATHER_CACHE_TTL_MS = 60 * 60 * 1000
export const WEATHER_FORECAST_HOURLY_VARS = [
  'temperature_2m',
  'precipitation_probability',
  'wind_speed_10m',
  'weather_code',
] as const

export const VALID_CHECK_INTERVALS = [5, 10, 15, 20, 30, 60]

export const DEFAULT_PREFERENCES = {
  scheduleIds: ['11078'],
  daysOfWeek: [0, 6],
  timeRange: { start: '07:00', end: '10:00' },
  players: 1,
  checkIntervalMinutes: 30,
  lookAheadDays: 7,
  discordWebhookUrl: '',
  weatherThresholds: {
    rainGoodMax: 20,
    rainBadMin: 60,
    windGoodMax: 5,
    windMidMax: 12,
    tempBadLow: 45,
    tempGoodMin: 60,
    tempGoodMax: 80,
    tempBadHigh: 90,
  },
}
