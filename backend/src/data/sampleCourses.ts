import { Course } from '../types'

export const sampleCourses: Omit<Course, 'id'>[] = [
  {
    name: 'Francis A. Byrne Golf Course',
    platform: 'francisbyrne',
    apiConfig: {
      baseUrl: 'https://foreupsoftware.com',
      endpoints: {
        search: '/index.php/api/booking/times',
        book: '/index.php/api/booking/reservations'
      },
      auth: {
        type: 'token',
        credentials: {
          token: process.env['FRANCIS_BYRNE_TOKEN'] || 'sample-token',
          refreshToken: process.env['FRANCIS_BYRNE_REFRESH_TOKEN'] || 'sample-refresh-token',
        }
      }
    },
    bookingWindow: {
      advanceDays: 7,
      startTime: '06:00'
    },
    timezone: 'America/New_York',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'GolfNow Example Course',
    platform: 'golfnow',
    apiConfig: {
      baseUrl: 'https://api.golfnow.com',
      endpoints: {
        search: '/tee-times/search',
        book: '/tee-times/book'
      },
      auth: {
        type: 'api-key',
        credentials: {
          apiKey: process.env['GOLFNOW_API_KEY'] || 'sample-api-key',
        }
      }
    },
    bookingWindow: {
      advanceDays: 14,
      startTime: '06:00'
    },
    timezone: 'America/New_York',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'TeeOff Example Course',
    platform: 'teeoff',
    apiConfig: {
      baseUrl: 'https://api.teeoff.com',
      endpoints: {
        search: '/tee-times/search',
        book: '/tee-times/book'
      },
      auth: {
        type: 'oauth',
        tokenRefreshUrl: '/auth/refresh',
        credentials: {
          accessToken: process.env['TEEOFF_ACCESS_TOKEN'] || 'sample-access-token',
          refreshToken: process.env['TEEOFF_REFRESH_TOKEN'] || 'sample-refresh-token',
        }
      }
    },
    bookingWindow: {
      advanceDays: 10,
      startTime: '06:00'
    },
    timezone: 'America/New_York',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
]

export const getSampleCourse = (platform: string): Omit<Course, 'id'> | null => {
  return sampleCourses.find(course => course.platform.toLowerCase() === platform.toLowerCase()) || null
}

export const getAllSampleCourses = (): Omit<Course, 'id'>[] => {
  return sampleCourses
} 