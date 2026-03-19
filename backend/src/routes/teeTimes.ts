import { Router, Request, Response } from 'express'
import { francisByrneAdapter } from '../adapters/FrancisByrneAdapter'
import { weatherService } from '../services/WeatherService'
import { TeeTime } from '../types'
import { resolveWeatherLocationFromTimes } from '../utils/weatherLocation'

const router = Router()

router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const { scheduleId, date, players } = req.query

    if (!scheduleId || !date) {
      res.status(400).json({ success: false, error: 'scheduleId and date are required' })
      return
    }

    const schedule = scheduleId as string
    const searchDate = date as string
    const times = await francisByrneAdapter.searchTeeTimes(
      [scheduleId as string],
      {
        date: searchDate,
        players: players ? parseInt(players as string) : 1,
      }
    )

    const location = resolveWeatherLocationFromTimes(times, schedule)
    if (!location) {
      res.json({ success: true, data: times })
      return
    }

    const weatherByTime = new Map<string, TeeTime['weather'] | null>()
    const enrichedTimes = await Promise.all(
      times.map(async (teeTime): Promise<TeeTime> => {
        if (weatherByTime.has(teeTime.time)) {
          const cachedWeather = weatherByTime.get(teeTime.time)
          return cachedWeather ? { ...teeTime, weather: cachedWeather } : teeTime
        }

        try {
          const weather = await weatherService.getWeatherForTeeTime(location, searchDate, teeTime.time)
          weatherByTime.set(teeTime.time, weather)
          return weather ? { ...teeTime, weather } : teeTime
        } catch (weatherErr: unknown) {
          const message = weatherErr instanceof Error ? weatherErr.message : String(weatherErr)
          console.warn(`[tee-times/search] weather enrichment failed for ${schedule} ${searchDate}: ${message}`)
          weatherByTime.set(teeTime.time, null)
          return teeTime
        }
      })
    )

    res.json({ success: true, data: enrichedTimes })
  } catch (err: any) {
    console.error('Error searching tee times:', err)
    res.status(500).json({ success: false, error: 'Failed to search tee times' })
  }
})

export default router
