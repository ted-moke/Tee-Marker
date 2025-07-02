import { Router, Request, Response } from 'express'
import { db } from '../index'
import { authenticateToken, optionalAuth } from '../middleware/auth'
import { TeeTime, Course } from '../types'
import { adapterService } from '../services/AdapterService'
import { SearchParams } from '../adapters/BaseAdapter'

const router = Router()

// Helper function to safely convert Firestore Timestamp to Date
const toDate = (timestamp: any): Date => {
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate()
  }
  return timestamp || new Date()
}

// Search for tee times
router.get('/search', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId, date, timeRange, players } = req.query

    if (!courseId || !date) {
      res.status(400).json({ error: 'Course ID and date are required' })
      return
    }

    // Get course details
    const courseDoc = await db.collection('courses').doc(courseId as string).get()
    if (!courseDoc.exists) {
      res.status(404).json({ error: 'Course not found' })
      return
    }

    const course = { id: courseDoc.id, ...courseDoc.data() } as Course

    // Use adapter service to search for tee times
    const searchParams: SearchParams = {
      date: date as string,
      timeRange: timeRange ? JSON.parse(timeRange as string) : undefined,
      ...(players && { players: parseInt(players as string) }),
    }

    const teeTimes = await adapterService.searchTeeTimes(course, searchParams)

    // Store found tee times in database
    for (const teeTime of teeTimes) {
      await db.collection('teeTimes').add({
        ...teeTime,
        lastChecked: new Date(),
        createdAt: new Date(),
      })
    }

    res.json({ success: true, data: teeTimes })
  } catch (error) {
    console.error('Error searching tee times:', error)
    res.status(500).json({ error: 'Failed to search tee times' })
  }
})

// Get recent tee times for a course
router.get('/course/:courseId', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params
    const { limit = '10' } = req.query

    const teeTimesSnapshot = await db
      .collection('teeTimes')
      .where('courseId', '==', courseId)
      .orderBy('lastChecked', 'desc')
      .limit(parseInt(limit as string))
      .get()

    const teeTimes: TeeTime[] = []
    teeTimesSnapshot.forEach((doc) => {
      const data = doc.data()
      teeTimes.push({
        id: doc.id,
        ...data,
        lastChecked: toDate(data['lastChecked']),
        createdAt: toDate(data['createdAt']),
      } as TeeTime)
    })

    res.json({ success: true, data: teeTimes })
  } catch (error) {
    console.error('Error fetching course tee times:', error)
    res.status(500).json({ error: 'Failed to fetch course tee times' })
  }
})

// Book a tee time
router.post('/book', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const { teeTimeId, bookingDetails } = req.body

    if (!teeTimeId || !bookingDetails) {
      res.status(400).json({ error: 'Tee time ID and booking details are required' })
      return
    }

    // Get tee time
    const teeTimeDoc = await db.collection('teeTimes').doc(teeTimeId).get()
    if (!teeTimeDoc.exists) {
      res.status(404).json({ error: 'Tee time not found' })
      return
    }

    const teeTimeData = { id: teeTimeDoc.id, ...teeTimeDoc.data() } as TeeTime

    // Get course details
    const courseDoc = await db.collection('courses').doc(teeTimeData.courseId).get()
    if (!courseDoc.exists) {
      res.status(404).json({ error: 'Course not found' })
      return
    }

    const course = { id: courseDoc.id, ...courseDoc.data() } as Course

    // Use adapter service to book the tee time
    const bookingParams = {
      teeTimeId: teeTimeData.platformId || teeTimeData.id,
      players: bookingDetails.players,
      userInfo: {
        name: req.user.name || 'User',
        email: req.user.email || '',
        phone: bookingDetails.phone,
      },
    }

    const booking = await adapterService.bookTeeTime(course, teeTimeData, bookingParams)

    // Store booking in database
    await db.collection('bookings').add({
      ...booking,
      userId: req.user.uid, // Override with actual user ID
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Update tee time availability
    await db.collection('teeTimes').doc(teeTimeId).update({
      availableSpots: teeTimeData.availableSpots - bookingDetails.players,
      lastChecked: new Date(),
    })

    res.status(201).json({ 
      success: true, 
      data: booking,
      message: 'Booking created successfully'
    })
  } catch (error) {
    console.error('Error booking tee time:', error)
    res.status(500).json({ error: 'Failed to book tee time' })
  }
})

// Get user's bookings
router.get('/bookings', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const bookingsSnapshot = await db
      .collection('bookings')
      .where('userId', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .get()

    const bookings: any[] = []
    bookingsSnapshot.forEach((doc) => {
      const data = doc.data()
      bookings.push({
        id: doc.id,
        ...data,
        createdAt: toDate(data['createdAt']),
        updatedAt: toDate(data['updatedAt']),
      })
    })

    res.json({ success: true, data: bookings })
  } catch (error) {
    console.error('Error fetching bookings:', error)
    res.status(500).json({ error: 'Failed to fetch bookings' })
  }
})

export default router 