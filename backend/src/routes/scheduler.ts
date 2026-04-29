import { Router, Request, Response } from 'express'
import { schedulerService } from '../services/SchedulerService'
import { ezLinksAdapter } from '../adapters/EzLinksAdapter'

const router = Router()

router.get(['/status', '/scheduler/status'], (_req: Request, res: Response): void => {
  res.json({ success: true, data: schedulerService.getStatus() })
})

router.post(['/run', '/scheduler/run'], async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await schedulerService.runCheck()
    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post(['/scheduler/weather-outlook', '/weather-outlook'], async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await schedulerService.runDailyWeatherSummary(true)
    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post(['/scheduler/test-tee-times', '/test-tee-times'], async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await schedulerService.runTeeTimeNotificationTest()
    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post(['/scheduler/test-ezlinks', '/test-ezlinks'], async (req: Request, res: Response): Promise<void> => {
  try {
    const dateCount = Math.min(Math.max(Number(req.body?.dates) || 5, 1), 20)
    const scheduleId = req.body?.scheduleId || '4549'

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    const results: Array<{ date: string; status: string; count?: number; error?: string; elapsed?: number }> = []

    for (let i = 0; i < dateCount; i++) {
      const d = new Date(tomorrow)
      d.setDate(d.getDate() + i)
      const date = d.toISOString().split('T')[0]!
      const start = Date.now()
      try {
        const times = await ezLinksAdapter.searchTeeTimes([scheduleId], { date, players: 1 })
        results.push({ date, status: 'ok', count: times.length, elapsed: Date.now() - start })
      } catch (err: any) {
        results.push({ date, status: 'error', error: err.message, elapsed: Date.now() - start })
      }
    }

    res.json({ success: true, data: { results } })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
