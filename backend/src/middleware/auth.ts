import { Request, Response, NextFunction } from 'express'
import { getAuth } from 'firebase-admin/auth'

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string
        email: string
        name?: string
      }
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) {
      res.status(401).json({ error: 'Access token required' })
      return
    }

    const decodedToken = await getAuth().verifyIdToken(token)
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      name: decodedToken['name'] || decodedToken['display_name']
    }
    
    next()
  } catch (error) {
    console.error('Token verification failed:', error)
    res.status(403).json({ error: 'Invalid token' })
  }
}

export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]

    if (token) {
      const decodedToken = await getAuth().verifyIdToken(token)
      
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email || '',
        name: decodedToken['name'] || decodedToken['display_name']
      }
    }
    
    next()
  } catch (error) {
    // For optional auth, we just continue without setting user
    console.log('Optional auth failed, continuing without user:', error)
    next()
  }
} 