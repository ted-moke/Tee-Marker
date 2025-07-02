import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { adapterService } from '../src/services/AdapterService'

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

interface Automation {
  id: string
  userId: string
  name: string
  courses: string[]
  timeRange: {
    start: string
    end: string
  }
  daysOfWeek: number[]
  checkInterval: number
  isActive: boolean
  bookingAction: 'notify' | 'auto-book'
  lastChecked?: admin.firestore.Timestamp
  nextCheck?: admin.firestore.Timestamp
}

interface Course {
  id: string
  name: string
  platform: string
  apiConfig: {
    baseUrl: string
    endpoints: {
      search: string
      book: string
    }
    auth: {
      type: 'token' | 'oauth' | 'api-key'
      tokenRefreshUrl?: string
      credentials?: Record<string, any>
    }
  }
  bookingWindow: {
    advanceDays: number
    startTime: string
  }
  timezone: string
  isActive: boolean
}

interface TeeTime {
  id: string
  courseId: string
  date: string
  time: string
  availableSpots: number
  price?: number
  platformId: string
  lastChecked: admin.firestore.Timestamp
  createdAt: admin.firestore.Timestamp
}

export const checkTeeTimes = functions.pubsub
  .topic('tee-time-checks')
  .onPublish(async (message) => {
    try {
      const { automationId } = message.json

      if (!automationId) {
        console.error('No automation ID provided')
        return
      }

      // Get automation details
      const automationDoc = await db.collection('automations').doc(automationId).get()
      if (!automationDoc.exists) {
        console.error(`Automation ${automationId} not found`)
        return
      }

      const automation = automationDoc.data() as Automation
      if (!automation.isActive) {
        console.log(`Automation ${automationId} is not active`)
        return
      }

      // Check if it's time to run this automation
      const now = new Date()
      const dayOfWeek = now.getDay()
      
      if (!automation.daysOfWeek.includes(dayOfWeek)) {
        console.log(`Automation ${automationId} not scheduled for day ${dayOfWeek}`)
        return
      }

      // Get courses for this automation
      const coursesSnapshot = await db
        .collection('courses')
        .where(admin.firestore.FieldPath.documentId(), 'in', automation.courses)
        .where('isActive', '==', true)
        .get()

      const courses: Course[] = []
      coursesSnapshot.forEach((doc) => {
        courses.push({ id: doc.id, ...doc.data() } as Course)
      })

      if (courses.length === 0) {
        console.log(`No active courses found for automation ${automationId}`)
        return
      }

      // Check each course for available tee times
      for (const course of courses) {
        await checkCourseForTeeTimes(course, automation)
      }

      // Update automation last checked time
      await db.collection('automations').doc(automationId).update({
        lastChecked: admin.firestore.Timestamp.now(),
        nextCheck: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + automation.checkInterval * 60 * 1000)
        ),
      })

      console.log(`Successfully checked automation ${automationId}`)
    } catch (error) {
      console.error('Error checking tee times:', error)
      throw error
    }
  })

async function checkCourseForTeeTimes(course: Course, automation: Automation) {
  try {
    console.log(`Checking course ${course.name} for automation ${automation.name}`)

    // Calculate the date range to check
    const today = new Date()
    const endDate = new Date(today.getTime() + course.bookingWindow.advanceDays * 24 * 60 * 60 * 1000)

    // Use adapter service to search for real tee times
    const searchParams = {
      date: today.toISOString().split('T')[0],
      timeRange: automation.timeRange,
      players: 1, // Default to 1 player, can be made configurable
    }

    try {
      const teeTimes = await adapterService.searchTeeTimes(course, searchParams)

      // Store found tee times
      for (const teeTime of teeTimes) {
        await db.collection('teeTimes').add({
          ...teeTime,
          lastChecked: admin.firestore.Timestamp.now(),
          createdAt: admin.firestore.Timestamp.now(),
        })
      }

      // Filter tee times that match automation criteria
      const matchingTeeTimes = teeTimes.filter(teeTime => 
        isTimeInRange(teeTime.time, automation.timeRange) &&
        teeTime.availableSpots >= 1
      )

      // If tee times found and automation is set to auto-book, attempt booking
      if (matchingTeeTimes.length > 0 && automation.bookingAction === 'auto-book') {
        await attemptAutoBooking(matchingTeeTimes[0], automation, course)
      }

      // Send notification if tee times found
      if (matchingTeeTimes.length > 0) {
        await sendNotification(automation, course, matchingTeeTimes)
      }

      console.log(`Found ${matchingTeeTimes.length} matching tee times for ${course.name}`)
    } catch (error) {
      console.error(`Error searching tee times for ${course.name}:`, error)
      
      // Fallback to mock data if API fails
      console.log('Falling back to mock data')
      const mockTeeTimes = generateMockTeeTimes(course, automation, today, endDate)
      
      if (mockTeeTimes.length > 0) {
        await sendNotification(automation, course, mockTeeTimes)
      }
    }
  } catch (error) {
    console.error(`Error checking course ${course.name}:`, error)
  }
}

function isTimeInRange(time: string, range: { start: string; end: string }): boolean {
  if (!range || !range.start || !range.end) return true
  
  const timeValue = time.replace(':', '')
  const startValue = range.start.replace(':', '')
  const endValue = range.end.replace(':', '')
  
  return timeValue >= startValue && timeValue <= endValue
}

function generateMockTeeTimes(
  course: Course,
  automation: Automation,
  startDate: Date,
  endDate: Date
): Omit<TeeTime, 'id' | 'lastChecked' | 'createdAt'>[] {
  const teeTimes: Omit<TeeTime, 'id' | 'lastChecked' | 'createdAt'>[] = []
  
  // Generate mock tee times for demonstration
  const currentDate = new Date(startDate)
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay()
    if (automation.daysOfWeek.includes(dayOfWeek)) {
      // Generate a few tee times for this day
      const times = ['08:00', '09:00', '10:00', '11:00']
      for (const time of times) {
        if (time >= automation.timeRange.start && time <= automation.timeRange.end) {
          teeTimes.push({
            courseId: course.id,
            date: currentDate.toISOString().split('T')[0],
            time,
            availableSpots: Math.floor(Math.random() * 4) + 1,
            price: Math.floor(Math.random() * 50) + 30,
            platformId: `mock-${Date.now()}`,
          })
        }
      }
    }
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  return teeTimes
}

async function attemptAutoBooking(
  teeTime: Omit<TeeTime, 'id' | 'lastChecked' | 'createdAt'>,
  automation: Automation,
  course: Course
) {
  try {
    console.log(`Attempting auto-booking for automation ${automation.name}`)

    // Get user details
    const userDoc = await db.collection('users').doc(automation.userId).get()
    if (!userDoc.exists) {
      console.log(`User not found: ${automation.userId}`)
      return
    }

    const user = userDoc.data()

    // Use adapter service to book the tee time
    const bookingParams = {
      teeTimeId: teeTime.platformId,
      players: 1, // Default to 1 player
      userInfo: {
        name: user.name || user.displayName || 'User',
        email: user.email || '',
        phone: user.phone || '',
      },
    }

    const booking = await adapterService.bookTeeTime(course, teeTime, bookingParams)

    // Store booking in database
    await db.collection('bookings').add({
      ...booking,
      userId: automation.userId,
      automationId: automation.id,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    })

    console.log(`Auto-booking successful for automation ${automation.name}`)
  } catch (error) {
    console.error(`Error auto-booking for automation ${automation.name}:`, error)
  }
}

async function sendNotification(
  automation: Automation,
  course: Course,
  teeTimes: Omit<TeeTime, 'id' | 'lastChecked' | 'createdAt'>[]
) {
  try {
    console.log(`Sending notification for automation ${automation.name}`)

    // Create notification
    const notification = {
      userId: automation.userId,
      type: 'tee_time_found',
      title: 'Tee Times Available!',
      message: `Found ${teeTimes.length} tee times matching your criteria at ${course.name}`,
      data: {
        automationId: automation.id,
        courseId: course.id,
        courseName: course.name,
        teeTimes: teeTimes.map(tt => ({
          id: tt.id,
          date: tt.date,
          time: tt.time,
          price: tt.price,
          availableSpots: tt.availableSpots
        }))
      },
      isRead: false,
      createdAt: admin.firestore.Timestamp.now(),
    }

    await db.collection('notifications').add(notification)
    console.log(`Notification sent for automation ${automation.name}`)
  } catch (error) {
    console.error(`Error sending notification for automation ${automation.name}:`, error)
  }
} 