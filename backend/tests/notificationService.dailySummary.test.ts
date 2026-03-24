import assert from 'node:assert/strict'
import test from 'node:test'
import axios from 'axios'
import { NotificationService } from '../src/services/NotificationService'
import { DailyWeatherSummaryDay } from '../src/types'

function stubAxiosPost(impl: typeof axios.post): () => void {
  const original = axios.post
  ;(axios.post as typeof axios.post) = impl
  return () => {
    ;(axios.post as typeof axios.post) = original
  }
}

test('daily summary message includes compact Temp and aligned sections', async () => {
  let sentDescription = ''
  const restore = stubAxiosPost(async (_url, body) => {
    sentDescription = String(body?.embeds?.[0]?.description ?? '')
    return { data: {} } as any
  })

  const days: DailyWeatherSummaryDay[] = [
    {
      date: '2026-03-23',
      weather: {
        temperatureHighF: 78,
        temperatureLowF: 61,
        precipitationProbabilityPct: 25,
        windSpeedMph: 8,
        weatherCode: 1,
        weatherLabel: 'Partly cloudy',
      },
    },
  ]

  try {
    const service = new NotificationService()
    await service.sendDailyWeatherSummary('https://discord.test/webhook', days)

    assert.match(sentDescription, /```/)
    assert.match(sentDescription, /Temp 78F\/61F/)
    assert.match(sentDescription, /Rain 25%/)
    assert.match(sentDescription, /Wind 8mph/)
  } finally {
    restore()
  }
})

test('daily summary placeholder uses compact missing temp format', async () => {
  let sentDescription = ''
  const restore = stubAxiosPost(async (_url, body) => {
    sentDescription = String(body?.embeds?.[0]?.description ?? '')
    return { data: {} } as any
  })

  const days: DailyWeatherSummaryDay[] = [{ date: '2026-03-23', weather: null }]

  try {
    const service = new NotificationService()
    await service.sendDailyWeatherSummary('https://discord.test/webhook', days)

    assert.match(sentDescription, /Temp --\/--/)
  } finally {
    restore()
  }
})
