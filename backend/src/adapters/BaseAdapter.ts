import { Course, TeeTime, Booking } from '../types'

export interface SearchParams {
  date: string
  timeRange?: {
    start: string
    end: string
  }
  players?: number
}

export interface BookingParams {
  teeTimeId: string
  players: number
  userInfo: {
    name: string
    email: string
    phone?: string
  }
}

export interface PlatformAdapter {
  // Search for available tee times
  searchTeeTimes(course: Course, params: SearchParams): Promise<TeeTime[]>
  
  // Book a tee time
  bookTeeTime(course: Course, teeTime: TeeTime, params: BookingParams): Promise<Booking>
  
  // Refresh authentication token if needed
  refreshToken?(course: Course): Promise<boolean>
  
  // Check if authentication is valid
  isAuthenticated?(course: Course): Promise<boolean>
  
  // Get course information
  getCourseInfo?(course: Course): Promise<any>
}

export abstract class BaseAdapter implements PlatformAdapter {
  protected course: Course
  protected axios: any

  constructor(course: Course, axios: any) {
    this.course = course
    this.axios = axios
  }

  abstract searchTeeTimes(course: Course, params: SearchParams): Promise<TeeTime[]>
  abstract bookTeeTime(course: Course, teeTime: TeeTime, params: BookingParams): Promise<Booking>

  protected async makeRequest(endpoint: string, options: any = {}) {
    const url = `${this.course.apiConfig.baseUrl}${endpoint}`
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
        ...options.headers,
      },
      ...options,
    }

    try {
      const response = await this.axios(url, config)
      return response.data
    } catch (error: any) {
      console.error(`Request failed for ${this.course.name}:`, error)
      throw new Error(`API request failed: ${error.message || 'Unknown error'}`)
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    const auth = this.course.apiConfig.auth
    
    switch (auth.type) {
      case 'api-key':
        return {
          'X-API-Key': auth.credentials?.['apiKey'] || '',
        }
      case 'token':
        return {
          'Authorization': `Bearer ${auth.credentials?.['token'] || ''}`,
        }
      case 'oauth':
        return {
          'Authorization': `Bearer ${auth.credentials?.['accessToken'] || ''}`,
        }
      default:
        return {}
    }
  }

  protected async refreshTokenIfNeeded(): Promise<boolean> {
    if (!('refreshToken' in this)) {
      return true
    }

    try {
      return await (this as any).refreshToken(this.course)
    } catch (error) {
      console.error('Token refresh failed:', error)
      return false
    }
  }

  protected validateResponse(response: any, expectedFields: string[]): boolean {
    if (!response) return false
    
    for (const field of expectedFields) {
      if (!(field in response)) {
        console.error(`Missing required field: ${field}`)
        return false
      }
    }
    
    return true
  }

  protected parseTime(timeString: string): string {
    // Convert various time formats to HH:MM
    const time = timeString.trim()
    
    // Handle "8:30 AM" format
    if (time.includes('AM') || time.includes('PM')) {
      const [timePart, period] = time.split(' ')
      if (!timePart) return time
      
      const timeComponents = timePart.split(':').map(Number)
      let hours = timeComponents[0]
      const minutes = timeComponents[1]
      
      if (hours === undefined || minutes === undefined) return time
      
      if (period === 'PM' && hours !== 12) hours += 12
      if (period === 'AM' && hours === 12) hours = 0
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    }
    
    // Handle "08:30" format
    if (time.includes(':')) {
      return time
    }
    
    // Handle "830" format
    if (time.length === 3 || time.length === 4) {
      const hours = time.slice(0, -2)
      const minutes = time.slice(-2)
      return `${hours.padStart(2, '0')}:${minutes}`
    }
    
    return time
  }

  protected parseDate(dateString: string): string {
    // Convert various date formats to YYYY-MM-DD
    const date = new Date(dateString)
    const isoString = date.toISOString().split('T')[0]
    return isoString || dateString
  }

  protected calculatePrice(priceData: any): number | undefined {
    if (typeof priceData === 'number') return priceData
    if (typeof priceData === 'string') {
      const numeric = parseFloat(priceData.replace(/[^0-9.]/g, ''))
      return isNaN(numeric) ? undefined : numeric
    }
    return undefined
  }
} 