import { Router } from 'express'
import { francisByrneAdapter } from '../adapters/FrancisByrneAdapter'
import { reservationSchedulerService } from '../services/SchedulerService'

const router = Router()

router.get('/', async (_req, res, next) => {
  try {
    const reservations = await francisByrneAdapter.fetchReservations()
    res.json({ success: true, data: reservations })
  } catch (err) {
    next(err)
  }
})

router.post('/refresh', async (_req, res, next) => {
  try {
    const reservations = await francisByrneAdapter.fetchReservations(true)
    res.json({ success: true, data: reservations })
  } catch (err) {
    next(err)
  }
})

router.post('/digest', async (_req, res, next) => {
  try {
    await reservationSchedulerService.runWeeklyDigest()
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
