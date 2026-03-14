import { Router, Request, Response } from 'express'
import { schedulerService } from '../services/SchedulerService'

const router = Router()

router.get('/status', (_req: Request, res: Response): void => {
  res.json({ success: true, data: schedulerService.getStatus() })
})

router.post('/run', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await schedulerService.runCheck()
    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
