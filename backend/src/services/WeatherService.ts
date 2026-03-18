import axios from 'axios'
import {
  CourseLocation,
  OPEN_METEO_BASE_URL,
  WEATHER_CACHE_TTL_MS,
  WEATHER_FORECAST_HOURLY_VARS,
} from '../constants'
import { TeeTimeWeather } from '../types'

interface OpenMeteoHourlyResponse {
  hourly?: {
    time?: string[]
    temperature_2m?: Array<number | null>
    precipitation_probability?: Array<number | null>
    wind_speed_10m?: Array<number | null>
    weather_code?: Array<number | null>
  }
}

interface CachedDailyForecast {
  expiresAtMs: number
  hourly: {
    time: string[]
    temperature_2m: Array<number | null>
    precipitation_probability: Array<number | null>
    wind_speed_10m: Array<number | null>
    weather_code: Array<number | null>
  }
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
  private readonly cache = new Map<string, CachedDailyForecast>()

  private cacheKey(location: CourseLocation, date: string): string {
    return `${location.latitude},${location.longitude},${location.timezone},${date}`
  }

  private async fetchDailyForecast(location: CourseLocation, date: string): Promise<CachedDailyForecast | null> {
    try {
      const response = await axios.get<OpenMeteoHourlyResponse>(OPEN_METEO_BASE_URL, {
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

  private async getDailyForecast(location: CourseLocation, date: string): Promise<CachedDailyForecast | null> {
    const key = this.cacheKey(location, date)
    const cached = this.cache.get(key)
    if (cached && cached.expiresAtMs > Date.now()) {
      return cached
    }

    console.log(`[WeatherService] cache miss key=${key}`)
    const fresh = await this.fetchDailyForecast(location, date)
    if (!fresh) {
      this.cache.delete(key)
      return null
    }

    this.cache.set(key, fresh)
    return fresh
  }

  async getWeatherForTeeTime(
    location: CourseLocation,
    date: string,
    teeTimeValue: string
  ): Promise<TeeTimeWeather | null> {
    const forecast = await this.getDailyForecast(location, date)
    if (!forecast) {
      return null
    }

    const teeMinutes = parseTimeToMinutes(teeTimeValue)
    if (teeMinutes === null) {
      return null
    }

    let bestIdx = -1
    let bestDistance = Number.POSITIVE_INFINITY
    for (let i = 0; i < forecast.hourly.time.length; i += 1) {
      const hour = hourFromIsoLocal(forecast.hourly.time[i] ?? '')
      if (hour === null) continue
      const forecastMinutes = hour * 60
      const distance = Math.abs(forecastMinutes - teeMinutes)
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
}

export const weatherService = new WeatherService()
