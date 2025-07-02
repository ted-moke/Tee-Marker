import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import authRoutes from './routes/auth'
import automationRoutes from './routes/automations'
import courseRoutes from './routes/courses'
import teeTimeRoutes from './routes/teeTimes'

// Initialize Firebase Admin
const serviceAccount = process.env['FIREBASE_SERVICE_ACCOUNT_KEY']
  ? JSON.parse(process.env['FIREBASE_SERVICE_ACCOUNT_KEY'])
  : undefined

if (serviceAccount) {
  initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env['GOOGLE_CLOUD_PROJECT'] || 'default-project',
  })
} else {
  initializeApp({
    projectId: process.env['GOOGLE_CLOUD_PROJECT'] || 'default-project',
  })
}

// Initialize Firestore
export const db = getFirestore()

// Create Express app
const app = express()

// Middleware
app.use(helmet())
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// CORS configuration
const corsOptions = {
  origin: process.env['NODE_ENV'] === 'production'
    ? process.env['FRONTEND_URL']
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  optionsSuccessStatus: 200
}
app.use(cors(corsOptions))

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env['NODE_ENV'] || 'development'
  })
})

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/automations', automationRoutes)
app.use('/api/courses', courseRoutes)
app.use('/api/tee-times', teeTimeRoutes)

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err)
  
  res.status(err.status || 500).json({
    success: false,
    error: process.env['NODE_ENV'] === 'production' ? 'Internal server error' : err.message,
    ...(process.env['NODE_ENV'] !== 'production' && { stack: err.stack })
  })
})

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  })
})

// Start server
const PORT = process.env['PORT'] || 8080

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`🌍 Environment: ${process.env['NODE_ENV'] || 'development'}`)
  console.log(`📊 Health check: http://localhost:${PORT}/health`)
}) 