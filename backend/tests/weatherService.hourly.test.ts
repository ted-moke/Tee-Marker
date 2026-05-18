import assert from 'node:assert/strict'
import test from 'node:test'
import axios from 'axios'
import { WeatherService } from '../src/services/WeatherService'

const location = {
  latitude: 40.7253,
  longitude: -74.2283,
  timezone: 'America/New_York',
}

const nearby = {
  latitude: 40.7197,
  longitude: -74.1934,
  timezone: 'America/New_York',
}

function stubAxiosGet(impl: typeof axios.get): () => void {
  const original = axios.get
  ;(axios.get as typeof axios.get) = impl
  return () => {
    ;(axios.get as typeof axios.get) = original
  }
}

function buildHourlyResponse(date: string) {
  const time: string[] = []
  const temperature: number[] = []
  const precip: number[] = []
  const wind: number[] = []
  const code: number[] = []
  for (let h = 0; h < 24; h += 1) {
    const hh = String(h).padStart(2, '0')
    time.push(`${date}T${hh}:00`)
    temperature.push(60 + h)
    precip.push(h)
    wind.push(5)
    code.push(0)
  }
  return {
    hourly: {
      time,
      temperature_2m: temperature,
      precipitation_probability: precip,
      wind_speed_10m: wind,
      weather_code: code,
    },
  }
}

test('parallel getWeatherForTeeTime calls dedup to one HTTP request', async () => {
  let callCount = 0
  let resolveResponse: (() => void) | null = null
  const responseReady = new Promise<void>(resolve => {
    resolveResponse = resolve
  })

  const restore = stubAxiosGet(async () => {
    callCount += 1
    await responseReady
    return { data: buildHourlyResponse('2026-03-23') } as any
  })

  try {
    const service = new WeatherService()
    const pending = Array.from({ length: 20 }, (_, i) => {
      const hh = String(7 + (i % 3)).padStart(2, '0')
      return service.getWeatherForTeeTime(location, '2026-03-23', `${hh}:15 AM`)
    })
    // Let all 20 promises start so they all hit the in-flight map before resolving.
    await new Promise(resolve => setImmediate(resolve))
    resolveResponse!()
    const results = await Promise.all(pending)

    assert.equal(callCount, 1, 'expected exactly one HTTP request for 20 parallel callers')
    assert.equal(results.length, 20)
    for (const r of results) {
      assert.ok(r, 'each caller should receive a weather payload')
    }
  } finally {
    restore()
  }
})

test('nearby coordinates (~3 mi) share a cache entry', async () => {
  let callCount = 0
  const restore = stubAxiosGet(async () => {
    callCount += 1
    return { data: buildHourlyResponse('2026-03-23') } as any
  })

  try {
    const service = new WeatherService()
    const a = await service.getWeatherForTeeTime(location, '2026-03-23', '08:00 AM')
    const b = await service.getWeatherForTeeTime(nearby, '2026-03-23', '08:00 AM')
    assert.ok(a)
    assert.ok(b)
    assert.equal(callCount, 1, 'nearby coords should snap to same cache key')
  } finally {
    restore()
  }
})

test('prefetchHourlyForDates fetches a single range and warms per-date cache', async () => {
  let callCount = 0
  const restore = stubAxiosGet(async (_url, config) => {
    callCount += 1
    const params = (config ?? {}).params as { start_date?: string; end_date?: string; hourly?: string } | undefined
    assert.equal(params?.start_date, '2026-03-23')
    assert.equal(params?.end_date, '2026-03-25')
    const time: string[] = []
    const temperature: number[] = []
    const precip: number[] = []
    const wind: number[] = []
    const code: number[] = []
    for (const date of ['2026-03-23', '2026-03-24', '2026-03-25']) {
      for (let h = 0; h < 24; h += 1) {
        const hh = String(h).padStart(2, '0')
        time.push(`${date}T${hh}:00`)
        temperature.push(60 + h)
        precip.push(h)
        wind.push(5)
        code.push(0)
      }
    }
    return {
      data: {
        hourly: {
          time,
          temperature_2m: temperature,
          precipitation_probability: precip,
          wind_speed_10m: wind,
          weather_code: code,
        },
      },
    } as any
  })

  try {
    const service = new WeatherService()
    await service.prefetchHourlyForDates(location, ['2026-03-23', '2026-03-24', '2026-03-25'])
    const a = await service.getWeatherForTeeTime(location, '2026-03-23', '08:00 AM')
    const b = await service.getWeatherForTeeTime(location, '2026-03-24', '08:00 AM')
    const c = await service.getWeatherForTeeTime(location, '2026-03-25', '08:00 AM')

    assert.equal(callCount, 1, 'prefetch should issue exactly one HTTP request for the date range')
    assert.ok(a && b && c)
  } finally {
    restore()
  }
})
