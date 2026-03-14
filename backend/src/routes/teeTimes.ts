import { Router, Request, Response } from 'express'
import { francisByrneAdapter } from '../adapters/FrancisByrneAdapter'

const router = Router()

router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const { scheduleId, date, players } = req.query

    if (!scheduleId || !date) {
      res.status(400).json({ success: false, error: 'scheduleId and date are required' })
      return
    }

    const times = await francisByrneAdapter.searchTeeTimes(
      [scheduleId as string],
      {
        date: date as string,
        players: players ? parseInt(players as string) : 1,
      }
    )

    res.json({ success: true, data: times })
  } catch (err: any) {
    console.error('Error searching tee times:', err)
    res.status(500).json({ success: false, error: 'Failed to search tee times' })
  }
})

export default router
