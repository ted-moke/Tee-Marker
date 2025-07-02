import axios from 'axios'
import { Course, TeeTime, Booking } from '../types'
import { PlatformAdapter, SearchParams, BookingParams } from '../adapters/BaseAdapter'
import { FrancisByrneAdapter } from '../adapters/FrancisByrneAdapter'

export class AdapterService {
  private adapters: Map<string, PlatformAdapter> = new Map()
  private axiosInstance: any

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'TeeMarker/1.0',
      },
    })

    // Add response interceptor for logging
    this.axiosInstance.interceptors.response.use(
      (response: any) => {
        console.log(`API Response: ${response.config.url} - ${response.status}`)
        return response
      },
      (error: any) => {
        console.error(`API Error: ${error.config?.url} - ${error.message}`)
        return Promise.reject(error)
      }
    )
  }

  getAdapter(course: Course): PlatformAdapter {
    const platform = course.platform.toLowerCase()
    
    if (this.adapters.has(platform)) {
      return this.adapters.get(platform)!
    }

    let adapter: PlatformAdapter

    switch (platform) {
      case 'francisbyrne':
      case 'francis-byrne':
      case 'francis_byrne':
        adapter = new FrancisByrneAdapter(course, this.axiosInstance)
        break
      
      // Add more platform adapters here
      // case 'golfnow':
      //   adapter = new GolfNowAdapter(course, this.axiosInstance)
      //   break
      
      // case 'teeoff':
      //   adapter = new TeeOffAdapter(course, this.axiosInstance)
      //   break
      
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }

    this.adapters.set(platform, adapter)
    return adapter
  }

  async searchTeeTimes(course: Course, params: SearchParams): Promise<TeeTime[]> {
    try {
      console.log(`Searching tee times for ${course.name} (${course.platform})`)
      
      const adapter = this.getAdapter(course)
      
      // Check authentication if needed
      if (adapter.isAuthenticated) {
        const isAuth = await adapter.isAuthenticated(course)
        if (!isAuth) {
          console.log(`Authentication failed for ${course.name}, attempting token refresh`)
          if (adapter.refreshToken) {
            const refreshed = await adapter.refreshToken(course)
            if (!refreshed) {
              throw new Error(`Authentication failed for ${course.name}`)
            }
          }
        }
      }

      const teeTimes = await adapter.searchTeeTimes(course, params)
      
      console.log(`Found ${teeTimes.length} tee times for ${course.name}`)
      return teeTimes

    } catch (error) {
      console.error(`Error searching tee times for ${course.name}:`, error)
      throw error
    }
  }

  async bookTeeTime(course: Course, teeTime: TeeTime, params: BookingParams): Promise<Booking> {
    try {
      console.log(`Booking tee time at ${course.name} (${course.platform})`)
      
      const adapter = this.getAdapter(course)
      
      // Check authentication if needed
      if (adapter.isAuthenticated) {
        const isAuth = await adapter.isAuthenticated(course)
        if (!isAuth) {
          console.log(`Authentication failed for ${course.name}, attempting token refresh`)
          if (adapter.refreshToken) {
            const refreshed = await adapter.refreshToken(course)
            if (!refreshed) {
              throw new Error(`Authentication failed for ${course.name}`)
            }
          }
        }
      }

      const booking = await adapter.bookTeeTime(course, teeTime, params)
      
      console.log(`Successfully booked tee time at ${course.name}: ${booking.id}`)
      return booking

    } catch (error) {
      console.error(`Error booking tee time at ${course.name}:`, error)
      throw error
    }
  }

  async refreshToken(course: Course): Promise<boolean> {
    try {
      console.log(`Refreshing token for ${course.name} (${course.platform})`)
      
      const adapter = this.getAdapter(course)
      
      if (!adapter.refreshToken) {
        console.log(`No token refresh available for ${course.name}`)
        return false
      }

      const success = await adapter.refreshToken(course)
      
      if (success) {
        console.log(`Token refreshed successfully for ${course.name}`)
      } else {
        console.log(`Token refresh failed for ${course.name}`)
      }
      
      return success

    } catch (error) {
      console.error(`Error refreshing token for ${course.name}:`, error)
      return false
    }
  }

  async getCourseInfo(course: Course): Promise<any> {
    try {
      console.log(`Getting course info for ${course.name} (${course.platform})`)
      
      const adapter = this.getAdapter(course)
      
      if (!adapter.getCourseInfo) {
        console.log(`No course info available for ${course.name}`)
        return null
      }

      const info = await adapter.getCourseInfo(course)
      
      console.log(`Retrieved course info for ${course.name}`)
      return info

    } catch (error) {
      console.error(`Error getting course info for ${course.name}:`, error)
      return null
    }
  }

  async testConnection(course: Course): Promise<boolean> {
    try {
      console.log(`Testing connection for ${course.name} (${course.platform})`)
      
      const adapter = this.getAdapter(course)
      
      // Try to get course info as a connection test
      if (adapter.getCourseInfo) {
        await adapter.getCourseInfo(course)
        return true
      }
      
      // If no getCourseInfo method, try authentication check
      if (adapter.isAuthenticated) {
        return await adapter.isAuthenticated(course)
      }
      
      // If no specific test methods, try a simple search
      const today = new Date().toISOString().split('T')[0]
      if (today) {
        await adapter.searchTeeTimes(course, { date: today })
      }
      return true

    } catch (error) {
      console.error(`Connection test failed for ${course.name}:`, error)
      return false
    }
  }

  getSupportedPlatforms(): string[] {
    return [
      'francisbyrne',
      'francis-byrne', 
      'francis_byrne',
      // Add more platforms as adapters are implemented
    ]
  }

  isPlatformSupported(platform: string): boolean {
    return this.getSupportedPlatforms().includes(platform.toLowerCase())
  }
}

// Export singleton instance
export const adapterService = new AdapterService() 