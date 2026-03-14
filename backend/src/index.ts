import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import preferencesRoutes from './routes/preferences'
import schedulerRoutes from './routes/scheduler'
import historyRoutes from './routes/history'
import teeTimeRoutes from './routes/teeTimes'
import { schedulerService } from './services/SchedulerService'
import { Preferences } from './types'
import { DEFAULT_PREFERENCES } from './constants'
import 'dotenv/config'

var admin = require('firebase-admin')

const serviceAccountKey = process.env['FIREBASE_SERVICE_ACCOUNT_KEY']
if (!serviceAccountKey) {
  console.error('FATAL: FIREBASE_SERVICE_ACCOUNT_KEY env var is not set')
  process.exit(1)
}

let parsedKey: object
try {
  if (serviceAccountKey.trim().startsWith('{')) {
    parsedKey = JSON.parse(serviceAccountKey.replace(/\\n/g, '\n'))
  } else {
    // Treat as a file path
    const fs = require('fs')
    parsedKey = JSON.parse(fs.readFileSync(serviceAccountKey, 'utf8'))
  }
} catch (err) {
  console.error('FATAL: FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON or a readable file path:', err)
  process.exit(1)
}

try {
  initializeApp({ credential: admin.credential.cert(parsedKey) })
} catch (err) {
  console.error('FATAL: Firebase initializeApp failed:', err)
  process.exit(1)
}

export const db = getFirestore()

const app = express()

app.use(helmet())
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

const corsOptions = {
  origin: process.env['NODE_ENV'] === 'production'
    ? process.env['FRONTEND_URL']
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  optionsSuccessStatus: 200
}
app.use(cors(corsOptions))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), schedulerRunning: schedulerService.getStatus().isRunning })
})

app.use('/api/preferences', preferencesRoutes)
app.use('/api', schedulerRoutes)
app.use('/api/history', historyRoutes)
app.use('/api/tee-times', teeTimeRoutes)

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(err.statusCode || err.status || 500).json({
    success: false,
    error: process.env['NODE_ENV'] === 'production' ? 'Internal server error' : err.message,
  })
})

app.use('*', (_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' })
})

const PORT = process.env['PORT'] || 8080

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`)
  try {
    const prefsDoc = await db.collection('preferences').doc('user').get()
    const interval = prefsDoc.exists
      ? (prefsDoc.data() as Preferences).checkIntervalMinutes
      : DEFAULT_PREFERENCES.checkIntervalMinutes
    schedulerService.start(interval)
    console.log(`Scheduler started (every ${interval} min)`)
  } catch (err: any) {
    console.error('Failed to start scheduler:', JSON.stringify(err, Object.getOwnPropertyNames(err)))
  }
})
