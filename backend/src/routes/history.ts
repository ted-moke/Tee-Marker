import { Router, Request, Response } from 'express'
import { db } from '../index'
import { CheckRecord } from '../types'

const router = Router()

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query['limit'] as string || '20'), 100)

    const snapshot = await db
      .collection('checks')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get()

    const records: CheckRecord[] = []
    snapshot.forEach(doc => {
      const d = doc.data()
      records.push({
        id: doc.id,
        timestamp: d['timestamp']?.toDate?.() ?? d['timestamp'],
        schedulesChecked: d['schedulesChecked'] ?? [],
        timesFound: d['timesFound'] ?? 0,
        notified: d['notified'] ?? 0,
        errors: d['errors'] ?? [],
      })
    })

    res.json({ success: true, data: records })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
