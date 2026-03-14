import { Router, Request, Response } from 'express'
import { db } from '../index'
import { schedulerService } from '../services/SchedulerService'
import { notificationService } from '../services/NotificationService'
import { Preferences } from '../types'
import { FRANCIS_BYRNE_SCHEDULES, VALID_CHECK_INTERVALS, DEFAULT_PREFERENCES } from '../constants'

const router = Router()

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('preferences').doc('user').get()
    const data = doc.exists ? (doc.data() as Preferences) : DEFAULT_PREFERENCES
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.put('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Partial<Preferences>

    // Validate
    if (body.scheduleIds) {
      const validIds = Object.keys(FRANCIS_BYRNE_SCHEDULES)
      if (!body.scheduleIds.every(id => validIds.includes(id))) {
        res.status(400).json({ success: false, error: 'Invalid scheduleIds' })
        return
      }
    }
    if (body.timeRange && body.timeRange.start >= body.timeRange.end) {
      res.status(400).json({ success: false, error: 'timeRange start must be before end' })
      return
    }
    if (body.players !== undefined && (body.players < 1 || body.players > 4)) {
      res.status(400).json({ success: false, error: 'players must be 1–4' })
      return
    }
    if (body.checkIntervalMinutes !== undefined && !VALID_CHECK_INTERVALS.includes(body.checkIntervalMinutes)) {
      res.status(400).json({ success: false, error: `checkIntervalMinutes must be one of ${VALID_CHECK_INTERVALS.join(', ')}` })
      return
    }

    const existing = await db.collection('preferences').doc('user').get()
    const prev = existing.exists ? (existing.data() as Preferences) : DEFAULT_PREFERENCES

    await db.collection('preferences').doc('user').set({ ...prev, ...body }, { merge: true })

    // Restart scheduler if interval changed
    const newInterval = body.checkIntervalMinutes ?? prev.checkIntervalMinutes
    if (newInterval !== prev.checkIntervalMinutes) {
      schedulerService.restart(newInterval)
    }

    const updated = await db.collection('preferences').doc('user').get()
    res.json({ success: true, data: updated.data() })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/test-webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const { url } = req.body
    if (!url) {
      res.status(400).json({ success: false, error: 'url is required' })
      return
    }
    const ok = await notificationService.testWebhook(url)
    if (ok) {
      res.json({ success: true })
    } else {
      res.status(400).json({ success: false, error: 'Webhook test failed — check the URL' })
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
