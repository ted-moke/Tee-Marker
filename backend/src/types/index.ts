// User types
export interface User {
  uid: string
  email: string
  name?: string | undefined
  preferences: {
    notifications: {
      email: boolean
      push: boolean
    }
    timezone: string
  }
  createdAt: Date
  updatedAt: Date
}

// Automation types
export interface Automation {
  id: string
  userId: string
  name: string
  courses: string[] // Course IDs
  timeRange: {
    start: string // HH:MM format
    end: string
  }
  daysOfWeek: number[] // 0-6 (Sunday-Saturday)
  checkInterval: number // minutes
  isActive: boolean
  bookingAction: 'notify' | 'auto-book'
  lastChecked?: Date
  nextCheck?: Date
  createdAt: Date
  updatedAt: Date
}

// Course types
export interface Course {
  id: string
  name: string
  platform: string // 'golfnow', 'teeoff', 'chronogolf', etc.
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
    startTime: string // HH:MM
  }
  timezone: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Tee Time types
export interface TeeTime {
  id: string
  courseId: string
  date: string // YYYY-MM-DD
  time: string // HH:MM
  availableSpots: number
  price?: number
  platformId: string
  lastChecked: Date
  createdAt: Date
}

// Booking types
export interface Booking {
  id: string
  userId: string
  automationId?: string
  courseId: string
  teeTimeId: string
  status: 'pending' | 'confirmed' | 'failed' | 'cancelled'
  bookingDetails: {
    date: string
    time: string
    players: number
    price?: number
  }
  platformResponse?: any
  errorMessage?: string
  createdAt: Date
  updatedAt: Date
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Request types
export interface CreateAutomationRequest {
  name: string
  courses: string[]
  timeRange: {
    start: string
    end: string
  }
  daysOfWeek: number[]
  checkInterval: number
  bookingAction: 'notify' | 'auto-book'
}

export interface UpdateAutomationRequest extends Partial<CreateAutomationRequest> {
  isActive?: boolean
}

export interface CreateCourseRequest {
  name: string
  platform: string
  apiConfig: Course['apiConfig']
  bookingWindow: Course['bookingWindow']
  timezone: string
}

export interface UpdateCourseRequest extends Partial<CreateCourseRequest> {
  isActive?: boolean
}

// Platform adapter types
export interface PlatformAdapter {
  searchTeeTimes(course: Course, date: string, timeRange?: { start: string; end: string }): Promise<TeeTime[]>
  bookTeeTime(course: Course, teeTime: TeeTime, bookingDetails: any): Promise<Booking>
  refreshToken?(course: Course): Promise<boolean>
}

// Error types
export class AppError extends Error {
  public statusCode: number
  public isOperational: boolean

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational

    Error.captureStackTrace(this, this.constructor)
  }
} 