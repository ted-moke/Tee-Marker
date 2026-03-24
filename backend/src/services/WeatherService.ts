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
  const normalized = trimmed.split(/[ T]/).pop()?.trim() ?? trimmed
  const m12 = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)

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

  const m24 = normalized.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
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

export class WeatherService {
  private readonly hourlyCache = new Map<string, CachedHourlyForecast>()
  private readonly dailyCache = new Map<string, CachedDailyForecast>()
  private readonly dailyRangeCache = new Map<string, CachedDailyForecast>()

  private cacheKey(location: CourseLocation, date: string): string {
    return `${location.latitude},${location.longitude},${location.timezone},${date}`
  }

  private rangeCacheKey(location: CourseLocation, startDate: string, endDate: string): string {
    return `${location.latitude},${location.longitude},${location.timezone},${startDate}..${endDate}`
  }

  private async fetchHourlyForecast(location: CourseLocation, date: string): Promise<CachedHourlyForecast | null> {
    try {
      const response = await axios.get<OpenMeteoForecastResponse>(OPEN_METEO_BASE_URL, {
        params: {
          latitude: location.latitude,
          longitude: location.longitude,
          timezone: location.timezone,
          start_date: date,
          end_date: date,
          hourly: WEATHER_FORECAST_HOURLY_VARS.join(','),
          temperature_unit: 'fahrenheit',
          wind_speed_unit: 'mph',
        },
        timeout: 10000,
      })

      const hourly = response.data.hourly
      const times = hourly?.time ?? []
      if (times.length === 0) {
        return null
      }

      return {
        expiresAtMs: Date.now() + WEATHER_CACHE_TTL_MS,
        hourly: {
          time: times,
          temperature_2m: hourly?.temperature_2m ?? [],
          precipitation_probability: hourly?.precipitation_probability ?? [],
          wind_speed_10m: hourly?.wind_speed_10m ?? [],
          weather_code: hourly?.weather_code ?? [],
        },
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`[WeatherService] Forecast request failed for date=${date}: ${message}`)
      return null
    }
  }

  private async getHourlyForecast(location: CourseLocation, date: string): Promise<CachedHourlyForecast | null> {
    const key = this.cacheKey(location, date)
    const cached = this.hourlyCache.get(key)
    if (cached && cached.expiresAtMs > Date.now()) {
      return cached
    }

    console.log(`[WeatherService] hourly cache miss key=${key}`)
    const fresh = await this.fetchHourlyForecast(location, date)
    if (!fresh) {
      this.hourlyCache.delete(key)
      return null
    }

    this.hourlyCache.set(key, fresh)
    return fresh
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
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await axios.get<OpenMeteoForecastResponse>(OPEN_METEO_BASE_URL, {
          params: {
            latitude: location.latitude,
            longitude: location.longitude,
            timezone: location.timezone,
            start_date: startDate,
            end_date: endDate,
            daily: WEATHER_FORECAST_DAILY_VARS.join(','),
            temperature_unit: 'fahrenheit',
            wind_speed_unit: 'mph',
          },
          timeout: 10000,
        })

        const daily = response.data.daily
        const days = daily?.time ?? []
        if (days.length === 0) {
          return null
        }

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
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } }).response?.status
        const message = err instanceof Error ? err.message : String(err)
        if (status === 429 && attempt < 2) {
          const waitMs = 300 * (attempt + 1) + Math.floor(Math.random() * 250)
          console.warn(
            `[WeatherService] Daily forecast 429 for ${startDate}..${endDate}; retrying in ${waitMs}ms (attempt ${attempt + 1}/3)`
          )
          await sleep(waitMs)
          continue
        }
        console.warn(`[WeatherService] Daily forecast request failed for ${startDate}..${endDate}: ${message}`)
        return null
      }
    }
    return null
  }

  private async getDailyForecast(location: CourseLocation, date: string): Promise<CachedDailyForecast | null> {
    const key = this.cacheKey(location, date)
    const cached = this.dailyCache.get(key)
    if (cached && cached.expiresAtMs > Date.now()) {
      return cached
    }

    console.log(`[WeatherService] daily cache miss key=${key}`)
    const fresh = await this.fetchDailyForecastRange(location, date, date)
    if (!fresh) {
      this.dailyCache.delete(key)
      return null
    }

    this.dailyCache.set(key, fresh)
    return fresh
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
    const forecast =
      cached && cached.expiresAtMs > Date.now()
        ? cached
        : await this.fetchDailyForecastRange(location, startDate, endDate)

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
