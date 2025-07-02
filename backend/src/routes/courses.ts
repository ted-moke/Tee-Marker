import { Router, Request, Response } from 'express'
import { db } from '../index'
import { authenticateToken } from '../middleware/auth'
import { Course, CreateCourseRequest, UpdateCourseRequest } from '../types'
import { adapterService } from '../services/AdapterService'

const router = Router()

// Helper function to safely convert Firestore Timestamp to Date
const toDate = (timestamp: any): Date => {
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate()
  }
  return timestamp || new Date()
}

// Get all courses
router.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const coursesSnapshot = await db
      .collection('courses')
      .orderBy('createdAt', 'desc')
      .get()

    const courses: Course[] = []
    coursesSnapshot.forEach((doc: any) => {
      const data = doc.data()
      courses.push({
        ...data,
        id: doc.id,
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
      } as Course)
    })

    res.json({ success: true, data: courses })
  } catch (error) {
    console.error('Error fetching courses:', error)
    res.status(500).json({ error: 'Failed to fetch courses' })
  }
})

// Get a specific course
router.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const { id } = req.params
    if (!id) {
      res.status(400).json({ error: 'Course ID is required' })
      return
    }

    const courseDoc = await db.collection('courses').doc(id).get()

    if (!courseDoc.exists) {
      res.status(404).json({ error: 'Course not found' })
      return
    }

    const data = courseDoc.data() as Course
    const course: Course = {
      ...data,
      id: courseDoc.id,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    }

    res.json({ success: true, data: course })
  } catch (error) {
    console.error('Error fetching course:', error)
    res.status(500).json({ error: 'Failed to fetch course' })
  }
})

// Create a new course
router.post('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const courseData: CreateCourseRequest = req.body

    // Validate required fields
    if (!courseData.name || !courseData.platform || !courseData.apiConfig) {
      res.status(400).json({ error: 'Missing required fields' })
      return
    }

    const newCourse: Omit<Course, 'id'> = {
      name: courseData.name,
      platform: courseData.platform,
      apiConfig: courseData.apiConfig,
      bookingWindow: courseData.bookingWindow,
      timezone: courseData.timezone,
      isActive: (courseData as any).isActive !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const docRef = await db.collection('courses').add(newCourse)
    const createdDoc = await docRef.get()
    const data = createdDoc.data() as Course

    const course: Course = {
      ...data,
      id: createdDoc.id,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    }

    res.status(201).json({ success: true, data: course })
  } catch (error) {
    console.error('Error creating course:', error)
    res.status(500).json({ error: 'Failed to create course' })
  }
})

// Update a course
router.put('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const { id } = req.params
    if (!id) {
      res.status(400).json({ error: 'Course ID is required' })
      return
    }

    const updateData: UpdateCourseRequest = req.body

    // Check if course exists
    const courseDoc = await db.collection('courses').doc(id).get()
    if (!courseDoc.exists) {
      res.status(404).json({ error: 'Course not found' })
      return
    }

    // Prepare update data
    const updateFields: Partial<Course> = {
      updatedAt: new Date(),
    }

    if (updateData.name !== undefined) updateFields.name = updateData.name
    if (updateData.platform !== undefined) updateFields.platform = updateData.platform
    if (updateData.apiConfig !== undefined) updateFields.apiConfig = updateData.apiConfig
    if (updateData.bookingWindow !== undefined) updateFields.bookingWindow = updateData.bookingWindow
    if (updateData.timezone !== undefined) updateFields.timezone = updateData.timezone
    if (updateData.isActive !== undefined) updateFields.isActive = updateData.isActive

    await db.collection('courses').doc(id).update(updateFields)

    const updatedDoc = await db.collection('courses').doc(id).get()
    const updatedData = updatedDoc.data() as Course

    const course: Course = {
      ...updatedData,
      id: updatedDoc.id,
      createdAt: toDate(updatedData.createdAt),
      updatedAt: toDate(updatedData.updatedAt),
    }

    res.json({ success: true, data: course })
  } catch (error) {
    console.error('Error updating course:', error)
    res.status(500).json({ error: 'Failed to update course' })
  }
})

// Delete a course
router.delete('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const { id } = req.params
    if (!id) {
      res.status(400).json({ error: 'Course ID is required' })
      return
    }

    // Check if course exists
    const courseDoc = await db.collection('courses').doc(id).get()
    if (!courseDoc.exists) {
      res.status(404).json({ error: 'Course not found' })
      return
    }

    await db.collection('courses').doc(id).delete()

    res.json({ success: true, message: 'Course deleted successfully' })
  } catch (error) {
    console.error('Error deleting course:', error)
    res.status(500).json({ error: 'Failed to delete course' })
  }
})

// Test course connection
router.post('/:id/test-connection', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const { id } = req.params
    if (!id) {
      res.status(400).json({ error: 'Course ID is required' })
      return
    }

    const courseDoc = await db.collection('courses').doc(id).get()
    if (!courseDoc.exists) {
      res.status(404).json({ error: 'Course not found' })
      return
    }

    const courseData = courseDoc.data() as Course
    const course: Course = {
      ...courseData,
      id: courseDoc.id,
      createdAt: toDate(courseData.createdAt),
      updatedAt: toDate(courseData.updatedAt),
    }

    const isConnected = await adapterService.testConnection(course)

    res.json({ 
      success: true, 
      data: { 
        courseId: id, 
        isConnected 
      } 
    })
  } catch (error) {
    console.error('Error testing course connection:', error)
    res.status(500).json({ error: 'Failed to test course connection' })
  }
})

// Get supported platforms
router.get('/platforms/supported', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const platforms = adapterService.getSupportedPlatforms()

    res.json({ 
      success: true, 
      data: platforms 
    })
  } catch (error) {
    console.error('Error fetching supported platforms:', error)
    res.status(500).json({ error: 'Failed to fetch supported platforms' })
  }
})

export default router 