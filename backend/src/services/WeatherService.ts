import axios from 'axios'
import {
  CourseLocation,
  OPEN_METEO_BASE_URL,
  WEATHER_CACHE_TTL_MS,
  WEATHER_FORECAST_DAILY_VARS,
  WEATHER_FORECAST_HOURLY_VARS,
} from '../constants'
import { DailyForecastWeather, TeeTimeWeather } from '../types'

interface OpenMeteoForecastResponse {
  hourly?: {
    time?: string[]
    temperature_2m?: Array<number | null>
    precipitation_probability?: Array<number | null>
    wind_speed_10m?: Array<number | null>
    weather_code?: Array<number | null>
  }
  daily?: {
    time?: string[]
    temperature_2m_max?: Array<number | null>
    temperature_2m_min?: Array<number | null>
    precipitation_probability_max?: Array<number | null>
    wind_speed_10m_max?: Array<number | null>
    weather_code?: Array<number | null>
  }
}

interface CachedHourlyForecast {
  expiresAtMs: number
  hourly: {
    time: string[]
    temperature_2m: Array<number | null>
    precipitation_probability: Array<number | null>
    wind_speed_10m: Array<number | null>
    weather_code: Array<number | null>
  }
}

interface CachedDailyForecast {
  expiresAtMs: number
  daily: {
    time: string[]
    temperature_2m_max: Array<number | null>
    temperature_2m_min: Array<number | null>
    precipitation_probability_max: Array<number | null>
    wind_speed_10m_max: Array<number | null>
    weather_code: Array<number | null>
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseTimeToMinutes(value: string): number | null {
  const trimmed = value.trim()

  const m12 = trimmed.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i)
  if (m12) {
    const rawHour = Number.parseInt(m12[1] ?? '', 10)
    const minute = Number.parseInt(m12[2] ?? '', 10)
    const suffix = (m12[3] ?? '').toUpperCase()
    if (
      Number.isNaN(rawHour) ||
      Number.isNaN(minute) ||
      minute < 0 ||
      minute > 59 ||
      rawHour < 1 ||
      rawHour > 12
    ) {
      return null
    }
    const hour24 = (rawHour % 12) + (suffix === 'PM' ? 12 : 0)
    return hour24 * 60 + minute
  }

  const m24 = trimmed.match(/(?:^|[ T])(\d{1,2}):(\d{2})(?::\d{2})?\s*$/)
  if (m24) {
    const hour = Number.parseInt(m24[1] ?? '', 10)
    const minute = Number.parseInt(m24[2] ?? '', 10)
    if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return null
    }
    return hour * 60 + minute
  }

  return null
}

function hourFromIsoLocal(iso: string): number | null {
  const hour = Number.parseInt(iso.slice(11, 13), 10)
  if (Number.isNaN(hour) || hour < 0 || hour > 23) {
    return null
  }
  return hour
}

function weatherCodeLabel(code: number | null): string {
  if (code === null) return 'Unknown'
  switch (code) {
    case 0:
      return 'Clear'
    case 1:
    case 2:
      return 'Partly cloudy'
    case 3:
      return 'Overcast'
    case 45:
    case 48:
      return 'Fog'
    case 51:
    case 53:
    case 55:
      return 'Drizzle'
    case 56:
    case 57:
      return 'Freezing drizzle'
    case 61:
    case 63:
    case 65:
      return 'Rain'
    case 66:
    case 67:
      return 'Freezing rain'
    case 71:
    case 73:
    case 75:
      return 'Snow'
    case 77:
      return 'Snow grains'
    case 80:
    case 81:
    case 82:
      return 'Rain showers'
    case 85:
    case 86:
      return 'Snow showers'
    case 95:
      return 'Thunderstorm'
    case 96:
    case 99:
      return 'Thunderstorm with hail'
    default:
      return 'Unknown'
  }
}

const CACHE_GRID_DEGREES = 0.1

function snapCoord(value: number): string {
  return (Math.round(value / CACHE_GRID_DEGREES) * CACHE_GRID_DEGREES).toFixed(2)
}

async function requestForecast(
  params: Record<string, string | number>,
  label: string
): Promise<OpenMeteoForecastResponse | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await axios.get<OpenMeteoForecastResponse>(OPEN_METEO_BASE_URL, {
        params,
        timeout: 10000,
      })
      return response.data
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status
      const message = err instanceof Error ? err.message : String(err)
      if (status === 429 && attempt < 2) {
        const waitMs = 1000 * 2 ** attempt + Math.floor(Math.random() * 500)
        console.warn(
          `[WeatherService] ${label} 429; retrying in ${waitMs}ms (attempt ${attempt + 1}/3)`
        )
        await sleep(waitMs)
        continue
      }
      console.warn(`[WeatherService] ${label} request failed: ${message}`)
      return null
    }
  }
  return null
}

export class WeatherService {
  private readonly hourlyCache = new Map<string, CachedHourlyForecast>()
  private readonly dailyCache = new Map<string, CachedDailyForecast>()
  private readonly dailyRangeCache = new Map<string, CachedDailyForecast>()
  private readonly hourlyInFlight = new Map<string, Promise<CachedHourlyForecast | null>>()
  private readonly dailyRangeInFlight = new Map<string, Promise<CachedDailyForecast | null>>()

  private cacheKey(location: CourseLocation, date: string): string {
    return `${snapCoord(location.latitude)},${snapCoord(location.longitude)},${location.timezone},${date}`
  }

  private rangeCacheKey(location: CourseLocation, startDate: string, endDate: string): string {
    return `${snapCoord(location.latitude)},${snapCoord(location.longitude)},${location.timezone},${startDate}..${endDate}`
  }

  private splitHourlyByDate(
    data: OpenMeteoForecastResponse,
    expiresAtMs: number
  ): Map<string, CachedHourlyForecast> {
    const result = new Map<string, CachedHourlyForecast>()
    const hourly = data.hourly
    const times = hourly?.time ?? []
    if (times.length === 0) return result

    for (let i = 0; i < times.length; i += 1) {
      const iso = times[i] ?? ''
      const date = iso.slice(0, 10)
      if (!date) continue
      let bucket = result.get(date)
      if (!bucket) {
        bucket = {
          expiresAtMs,
          hourly: {
            time: [],
            temperature_2m: [],
            precipitation_probability: [],
            wind_speed_10m: [],
            weather_code: [],
          },
        }
        result.set(date, bucket)
      }
      bucket.hourly.time.push(iso)
      bucket.hourly.temperature_2m.push(hourly?.temperature_2m?.[i] ?? null)
      bucket.hourly.precipitation_probability.push(hourly?.precipitation_probability?.[i] ?? null)
      bucket.hourly.wind_speed_10m.push(hourly?.wind_speed_10m?.[i] ?? null)
      bucket.hourly.weather_code.push(hourly?.weather_code?.[i] ?? null)
    }
    return result
  }

  private async fetchHourlyRange(
    location: CourseLocation,
    startDate: string,
    endDate: string
  ): Promise<Map<string, CachedHourlyForecast>> {
    const data = await requestForecast(
      {
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: location.timezone,
        start_date: startDate,
        end_date: endDate,
        hourly: WEATHER_FORECAST_HOURLY_VARS.join(','),
        temperature_unit: 'fahrenheit',
        wind_speed_unit: 'mph',
      },
      `Hourly forecast ${startDate}..${endDate}`
    )
    if (!data) return new Map()
    return this.splitHourlyByDate(data, Date.now() + WEATHER_CACHE_TTL_MS)
  }

  async prefetchHourlyForDates(location: CourseLocation, dates: string[]): Promise<void> {
    if (dates.length === 0) return
    const sorted = [...new Set(dates)].sort((a, b) => a.localeCompare(b))
    const stale = sorted.filter(date => {
      const cached = this.hourlyCache.get(this.cacheKey(location, date))
      return !cached || cached.expiresAtMs <= Date.now()
    })
    if (stale.length === 0) return

    const startDate = stale[0]!
    const endDate = stale[stale.length - 1]!
    console.log(
      `[WeatherService] hourly prefetch ${snapCoord(location.latitude)},${snapCoord(location.longitude)} ${startDate}..${endDate} (${stale.length} dates)`
    )
    const buckets = await this.fetchHourlyRange(location, startDate, endDate)
    for (const [date, bucket] of buckets) {
      this.hourlyCache.set(this.cacheKey(location, date), bucket)
    }
  }

  private async getHourlyForecast(location: CourseLocation, date: string): Promise<CachedHourlyForecast | null> {
    const key = this.cacheKey(location, date)
    const cached = this.hourlyCache.get(key)
    if (cached && cached.expiresAtMs > Date.now()) {
      return cached
    }

    const inFlight = this.hourlyInFlight.get(key)
    if (inFlight) {
      return inFlight
    }

    console.log(`[WeatherService] hourly cache miss key=${key}`)
    const pending = this.fetchHourlyRange(location, date, date)
      .then(buckets => buckets.get(date) ?? null)
      .then(fresh => {
        if (!fresh) {
          this.hourlyCache.delete(key)
          return null
        }
        this.hourlyCache.set(key, fresh)
        return fresh
      })
      .finally(() => {
        this.hourlyInFlight.delete(key)
      })
    this.hourlyInFlight.set(key, pending)
    return pending
  }

  async getWeatherForTeeTime(
    location: CourseLocation,
    date: string,
    teeTimeValue: string,
    forecastOffsetHours: number = 0
  ): Promise<TeeTimeWeather | null> {
    const forecast = await this.getHourlyForecast(location, date)
    if (!forecast) {
      return null
    }

    const teeMinutes = parseTimeToMinutes(teeTimeValue)
    if (teeMinutes === null) {
      return null
    }
    const safeOffsetHours = Number.isFinite(forecastOffsetHours) ? forecastOffsetHours : 0
    const targetMinutes = teeMinutes + safeOffsetHours * 60

    let bestIdx = -1
    let bestDistance = Number.POSITIVE_INFINITY
    for (let i = 0; i < forecast.hourly.time.length; i += 1) {
      const hour = hourFromIsoLocal(forecast.hourly.time[i] ?? '')
      if (hour === null) continue
      const forecastMinutes = hour * 60
      const distance = Math.abs(forecastMinutes - targetMinutes)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIdx = i
      }
    }

    if (bestIdx < 0) {
      return null
    }

    const temperatureF = forecast.hourly.temperature_2m[bestIdx] ?? null
    const precipitationProbabilityPct = forecast.hourly.precipitation_probability[bestIdx] ?? null
    const windSpeedMph = forecast.hourly.wind_speed_10m[bestIdx] ?? null
    const weatherCode = forecast.hourly.weather_code[bestIdx] ?? null

    return {
      temperatureF,
      precipitationProbabilityPct,
      windSpeedMph,
      weatherCode,
      weatherLabel: weatherCodeLabel(weatherCode),
    }
  }

  private mapDailyWeatherAtIndex(forecast: CachedDailyForecast, index: number): DailyForecastWeather {
    const temperatureHighF = forecast.daily.temperature_2m_max[index] ?? null
    const temperatureLowF = forecast.daily.temperature_2m_min[index] ?? null
    const precipitationProbabilityPct = forecast.daily.precipitation_probability_max[index] ?? null
    const windSpeedMph = forecast.daily.wind_speed_10m_max[index] ?? null
    const weatherCode = forecast.daily.weather_code[index] ?? null
    return {
      temperatureHighF,
      temperatureLowF,
      precipitationProbabilityPct,
      windSpeedMph,
      weatherCode,
      weatherLabel: weatherCodeLabel(weatherCode),
    }
  }

  private async fetchDailyForecastRange(
    location: CourseLocation,
    startDate: string,
    endDate: string
  ): Promise<CachedDailyForecast | null> {
    const data = await requestForecast(
      {
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: location.timezone,
        start_date: startDate,
        end_date: endDate,
        daily: WEATHER_FORECAST_DAILY_VARS.join(','),
        temperature_unit: 'fahrenheit',
        wind_speed_unit: 'mph',
      },
      `Daily forecast ${startDate}..${endDate}`
    )
    if (!data) return null
    const daily = data.daily
    const days = daily?.time ?? []
    if (days.length === 0) return null

    return {
      expiresAtMs: Date.now() + WEATHER_CACHE_TTL_MS,
      daily: {
        time: days,
        temperature_2m_max: daily?.temperature_2m_max ?? [],
        temperature_2m_min: daily?.temperature_2m_min ?? [],
        precipitation_probability_max: daily?.precipitation_probability_max ?? [],
        wind_speed_10m_max: daily?.wind_speed_10m_max ?? [],
        weather_code: daily?.weather_code ?? [],
      },
    }
  }

  private async getDailyForecast(location: CourseLocation, date: string): Promise<CachedDailyForecast | null> {
    const key = this.cacheKey(location, date)
    const cached = this.dailyCache.get(key)
    if (cached && cached.expiresAtMs > Date.now()) {
      return cached
    }

    const inFlight = this.dailyRangeInFlight.get(key)
    if (inFlight) {
      return inFlight
    }

    console.log(`[WeatherService] daily cache miss key=${key}`)
    const pending = this.fetchDailyForecastRange(location, date, date)
      .then(fresh => {
        if (!fresh) {
          this.dailyCache.delete(key)
          return null
        }
        this.dailyCache.set(key, fresh)
        return fresh
      })
      .finally(() => {
        this.dailyRangeInFlight.delete(key)
      })
    this.dailyRangeInFlight.set(key, pending)
    return pending
  }

  async getDailyWeather(location: CourseLocation, date: string): Promise<DailyForecastWeather | null> {
    const forecast = await this.getDailyForecast(location, date)
    if (!forecast) {
      return null
    }

    const dayIdx = forecast.daily.time.findIndex(value => value === date)
    const bestIdx = dayIdx >= 0 ? dayIdx : 0
    return this.mapDailyWeatherAtIndex(forecast, bestIdx)
  }

  async getDailyWeatherRange(
    location: CourseLocation,
    dates: string[]
  ): Promise<Map<string, DailyForecastWeather | null>> {
    const result = new Map<string, DailyForecastWeather | null>()
    if (dates.length === 0) {
      return result
    }

    const uniqueDates = [...new Set(dates)].sort((a, b) => a.localeCompare(b))
    const startDate = uniqueDates[0]
    const endDate = uniqueDates[uniqueDates.length - 1]
    if (!startDate || !endDate) {
      return result
    }

    const rangeKey = this.rangeCacheKey(location, startDate, endDate)
    const cached = this.dailyRangeCache.get(rangeKey)
    let forecast: CachedDailyForecast | null
    if (cached && cached.expiresAtMs > Date.now()) {
      forecast = cached
    } else {
      const existing = this.dailyRangeInFlight.get(rangeKey)
      if (existing) {
        forecast = await existing
      } else {
        const pending = this.fetchDailyForecastRange(location, startDate, endDate).finally(() => {
          this.dailyRangeInFlight.delete(rangeKey)
        })
        this.dailyRangeInFlight.set(rangeKey, pending)
        forecast = await pending
      }
    }

    if (!forecast) {
      for (const date of uniqueDates) {
        result.set(date, null)
      }
      return result
    }

    this.dailyRangeCache.set(rangeKey, forecast)
    for (let i = 0; i < forecast.daily.time.length; i += 1) {
      const day = forecast.daily.time[i]
      if (!day) continue
      const weather = this.mapDailyWeatherAtIndex(forecast, i)
      result.set(day, weather)
      this.dailyCache.set(this.cacheKey(location, day), {
        expiresAtMs: forecast.expiresAtMs,
        daily: {
          time: [day],
          temperature_2m_max: [weather.temperatureHighF],
          temperature_2m_min: [weather.temperatureLowF],
          precipitation_probability_max: [weather.precipitationProbabilityPct],
          wind_speed_10m_max: [weather.windSpeedMph],
          weather_code: [weather.weatherCode],
        },
      })
    }

    for (const date of uniqueDates) {
      if (!result.has(date)) {
        result.set(date, null)
      }
    }
    return result
  }
}

export const weatherService = new WeatherService()
