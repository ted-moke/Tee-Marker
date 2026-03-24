import assert from 'node:assert/strict'
import test from 'node:test'
import axios from 'axios'
import { WeatherService } from '../src/services/WeatherService'

const location = {
  latitude: 40.7253,
  longitude: -74.2283,
  timezone: 'America/New_York',
}

function stubAxiosGet(impl: typeof axios.get): () => void {
  const original = axios.get
  ;(axios.get as typeof axios.get) = impl
  return () => {
    ;(axios.get as typeof axios.get) = original
  }
}

test('getDailyWeather maps daily high/low and labels', async () => {
  const restore = stubAxiosGet(async () => ({
    data: {
      daily: {
        time: ['2026-03-23'],
        temperature_2m_max: [72.6],
        temperature_2m_min: [54.1],
        precipitation_probability_max: [38],
        wind_speed_10m_max: [11.2],
        weather_code: [3],
      },
    },
  }) as any)

  try {
    const service = new WeatherService()
    const weather = await service.getDailyWeather(location, '2026-03-23')

    assert.deepEqual(weather, {
      temperatureHighF: 72.6,
      temperatureLowF: 54.1,
      precipitationProbabilityPct: 38,
      windSpeedMph: 11.2,
      weatherCode: 3,
      weatherLabel: 'Overcast',
    })
  } finally {
    restore()
  }
})

test('getDailyWeather returns null when daily payload is empty', async () => {
  const restore = stubAxiosGet(async () => ({
    data: {
      daily: {
        time: [],
      },
    },
  }) as any)

  try {
    const service = new WeatherService()
    const weather = await service.getDailyWeather(location, '2026-03-23')
    assert.equal(weather, null)
  } finally {
    restore()
  }
})

test('getDailyWeatherRange fetches once and maps each requested day', async () => {
  let callCount = 0
  const restore = stubAxiosGet(async (_url, config) => {
    callCount += 1
    const params = (config ?? {}).params as { start_date?: string; end_date?: string } | undefined
    assert.equal(params?.start_date, '2026-03-23')
    assert.equal(params?.end_date, '2026-03-25')
    return {
      data: {
        daily: {
          time: ['2026-03-23', '2026-03-24', '2026-03-25'],
          temperature_2m_max: [70, 71, 72],
          temperature_2m_min: [50, 51, 52],
          precipitation_probability_max: [10, 20, 30],
          wind_speed_10m_max: [5, 6, 7],
          weather_code: [0, 1, 3],
        },
      },
    } as any
  })

  try {
    const service = new WeatherService()
    const weatherByDay = await service.getDailyWeatherRange(location, ['2026-03-23', '2026-03-24', '2026-03-25'])

    assert.equal(callCount, 1)
    assert.equal(weatherByDay.get('2026-03-23')?.temperatureHighF, 70)
    assert.equal(weatherByDay.get('2026-03-24')?.temperatureHighF, 71)
    assert.equal(weatherByDay.get('2026-03-25')?.weatherLabel, 'Overcast')
  } finally {
    restore()
  }
})
