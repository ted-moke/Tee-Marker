import { Router, Request, Response } from 'express'
import { db } from '../index'
import { authenticateToken } from '../middleware/auth'
import { Automation, CreateAutomationRequest, UpdateAutomationRequest } from '../types'

const router = Router()

// Helper function to safely convert Firestore Timestamp to Date
const toDate = (timestamp: any): Date => {
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate()
  }
  return timestamp || new Date()
}

// Get all automations for the current user
router.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const automationsSnapshot = await db
      .collection('automations')
      .where('userId', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .get()

    const automations: Automation[] = []
    automationsSnapshot.forEach((doc: any) => {
      const data = doc.data()
      automations.push({
        ...data,
        id: doc.id,
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
        lastChecked: data.lastChecked ? toDate(data.lastChecked) : undefined,
        nextCheck: data.nextCheck ? toDate(data.nextCheck) : undefined,
      } as Automation)
    })

    res.json({ success: true, data: automations })
  } catch (error) {
    console.error('Error fetching automations:', error)
    res.status(500).json({ error: 'Failed to fetch automations' })
  }
})

// Get a specific automation
router.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const { id } = req.params
    if (!id) {
      res.status(400).json({ error: 'Automation ID is required' })
      return
    }

    const automationDoc = await db.collection('automations').doc(id).get()

    if (!automationDoc.exists) {
      res.status(404).json({ error: 'Automation not found' })
      return
    }

    const data = automationDoc.data() as Automation
    if (data.userId !== req.user.uid) {
      res.status(403).json({ error: 'Access denied' })
      return
    }

    const automation: Automation = {
      ...data,
      id: automationDoc.id,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      lastChecked: data.lastChecked ? toDate(data.lastChecked) : undefined,
      nextCheck: data.nextCheck ? toDate(data.nextCheck) : undefined,
    } as Automation

    res.json({ success: true, data: automation })
  } catch (error) {
    console.error('Error fetching automation:', error)
    res.status(500).json({ error: 'Failed to fetch automation' })
  }
})

// Create a new automation
router.post('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const automationData: CreateAutomationRequest = req.body

    // Validate required fields
    if (!automationData.name || !automationData.courses || !automationData.timeRange) {
      res.status(400).json({ error: 'Missing required fields' })
      return
    }

    const newAutomation: Omit<Automation, 'id'> = {
      userId: req.user.uid,
      name: automationData.name,
      courses: automationData.courses,
      timeRange: automationData.timeRange,
      daysOfWeek: automationData.daysOfWeek,
      checkInterval: automationData.checkInterval,
      isActive: automationData.bookingAction === 'auto-book',
      bookingAction: automationData.bookingAction,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const docRef = await db.collection('automations').add(newAutomation)
    const createdDoc = await docRef.get()
    const data = createdDoc.data() as Automation

    const automation: Automation = {
      ...data,
      id: createdDoc.id,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    }

    res.status(201).json({ success: true, data: automation })
  } catch (error) {
    console.error('Error creating automation:', error)
    res.status(500).json({ error: 'Failed to create automation' })
  }
})

// Update an automation
router.put('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const { id } = req.params
    if (!id) {
      res.status(400).json({ error: 'Automation ID is required' })
      return
    }

    const updateData: UpdateAutomationRequest = req.body

    // Check if automation exists and belongs to user
    const automationDoc = await db.collection('automations').doc(id).get()
    if (!automationDoc.exists) {
      res.status(404).json({ error: 'Automation not found' })
      return
    }

    const data = automationDoc.data() as Automation
    if (data.userId !== req.user.uid) {
      res.status(403).json({ error: 'Access denied' })
      return
    }

    // Prepare update data
    const updateFields: Partial<Automation> = {
      updatedAt: new Date(),
    }

    if (updateData.name !== undefined) updateFields.name = updateData.name
    if (updateData.courses !== undefined) updateFields.courses = updateData.courses
    if (updateData.timeRange !== undefined) updateFields.timeRange = updateData.timeRange
    if (updateData.daysOfWeek !== undefined) updateFields.daysOfWeek = updateData.daysOfWeek
    if (updateData.checkInterval !== undefined) updateFields.checkInterval = updateData.checkInterval
    if (updateData.bookingAction !== undefined) updateFields.bookingAction = updateData.bookingAction
    if (updateData.isActive !== undefined) updateFields.isActive = updateData.isActive

    await db.collection('automations').doc(id).update(updateFields)

    const updatedDoc = await db.collection('automations').doc(id).get()
    const updatedData = updatedDoc.data() as Automation

    const automation: Automation = {
      ...updatedData,
      id: updatedDoc.id,
      createdAt: toDate(updatedData.createdAt),
      updatedAt: toDate(updatedData.updatedAt),
      lastChecked: updatedData.lastChecked ? toDate(updatedData.lastChecked) : undefined,
      nextCheck: updatedData.nextCheck ? toDate(updatedData.nextCheck) : undefined,
    } as Automation

    res.json({ success: true, data: automation })
  } catch (error) {
    console.error('Error updating automation:', error)
    res.status(500).json({ error: 'Failed to update automation' })
  }
})

// Delete an automation
router.delete('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const { id } = req.params
    if (!id) {
      res.status(400).json({ error: 'Automation ID is required' })
      return
    }

    // Check if automation exists and belongs to user
    const automationDoc = await db.collection('automations').doc(id).get()
    if (!automationDoc.exists) {
      res.status(404).json({ error: 'Automation not found' })
      return
    }

    const data = automationDoc.data() as Automation
    if (data.userId !== req.user.uid) {
      res.status(403).json({ error: 'Access denied' })
      return
    }

    await db.collection('automations').doc(id).delete()

    res.json({ success: true, message: 'Automation deleted successfully' })
  } catch (error) {
    console.error('Error deleting automation:', error)
    res.status(500).json({ error: 'Failed to delete automation' })
  }
})

// Toggle automation active status
router.patch('/:id/toggle', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const { id } = req.params
    if (!id) {
      res.status(400).json({ error: 'Automation ID is required' })
      return
    }

    // Check if automation exists and belongs to user
    const automationDoc = await db.collection('automations').doc(id).get()
    if (!automationDoc.exists) {
      res.status(404).json({ error: 'Automation not found' })
      return
    }

    const data = automationDoc.data() as Automation
    if (data.userId !== req.user.uid) {
      res.status(403).json({ error: 'Access denied' })
      return
    }

    // Toggle the active status
    await db.collection('automations').doc(id).update({
      isActive: !data.isActive,
      updatedAt: new Date(),
    })

    res.json({ 
      success: true, 
      data: { 
        id, 
        isActive: !data.isActive 
      } 
    })
  } catch (error) {
    console.error('Error toggling automation:', error)
    res.status(500).json({ error: 'Failed to toggle automation' })
  }
})

export default router 