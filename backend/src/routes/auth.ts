import { Router, Request, Response } from 'express'
import { getAuth } from 'firebase-admin/auth'
import { db } from '../index'
import { authenticateToken } from '../middleware/auth'
import { User } from '../types'

const router = Router()

// Get current user profile
router.get('/profile', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const userDoc = await db.collection('users').doc(req.user.uid).get()
    
    if (!userDoc.exists) {
      // Create user profile if it doesn't exist
      const userData: User = {
        uid: req.user.uid,
        email: req.user.email,
        name: req.user.name || undefined,
        preferences: {
          notifications: {
            email: true,
            push: true,
          },
          timezone: 'America/New_York',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await db.collection('users').doc(req.user.uid).set(userData)
      res.json({ success: true, data: userData })
      return
    }

    const userData = userDoc.data() as User
    res.json({ success: true, data: userData })
  } catch (error) {
    console.error('Error fetching user profile:', error)
    res.status(500).json({ error: 'Failed to fetch user profile' })
  }
})

// Update user profile
router.put('/profile', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const { name, preferences } = req.body
    const updateData: Partial<User> = {
      updatedAt: new Date(),
    }

    if (name !== undefined) updateData.name = name
    if (preferences !== undefined) updateData.preferences = preferences

    await db.collection('users').doc(req.user.uid).update(updateData)

    const updatedDoc = await db.collection('users').doc(req.user.uid).get()
    const userData = updatedDoc.data() as User

    res.json({ success: true, data: userData })
  } catch (error) {
    console.error('Error updating user profile:', error)
    res.status(500).json({ error: 'Failed to update user profile' })
  }
})

// Verify Firebase token (for frontend)
router.post('/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body

    if (!token) {
      res.status(400).json({ error: 'Token is required' })
      return
    }

    const auth = getAuth()
    const decodedToken = await auth.verifyIdToken(token)

    res.json({
      success: true,
      data: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken['name'] || decodedToken.email?.split('@')[0],
      },
    })
  } catch (error) {
    console.error('Error verifying token:', error)
    res.status(401).json({ error: 'Invalid token' })
  }
})

export default router 