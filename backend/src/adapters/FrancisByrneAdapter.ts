import { BaseAdapter, SearchParams, BookingParams } from './BaseAdapter'
import { Course, TeeTime, Booking } from '../types'
import axios, { AxiosInstance } from 'axios'

interface StripeSession {
  muid: string
  guid: string
  sid: string
}

interface LoginResponse {
  jwt: string
  user_id: number
  booking_class_ids: number[]
  person_id: string
}

type TeeTimeResponse = Array<{
    time: string
    available_spots: number
    price: string
    booking_class_id: number
    schedule_id: number
  }>


export class FrancisByrneAdapter extends BaseAdapter {
  private client: AxiosInstance
  private jwtToken: string | null = null
  private sessionCookies: string | null = null
  private bookingClassId: number = 49772 // Default booking class for non-resident adult

  constructor(course: Course, axiosInstance: any) {
    super(course, axiosInstance)
    this.client = axios.create({
      baseURL: 'https://foreupsoftware.com',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
        'Api-Key': 'no_limits',
        'X-Fu-Golfer-Location': 'foreup',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
  }

  async initialize(): Promise<void> {
    try {
      // Step 1: Initialize Stripe session
      await this.initializeStripeSession()
      
      // Step 2: Login to get JWT token
      await this.login()
      
      console.log('Francis Byrne adapter initialized successfully')
    } catch (error) {
      console.error('Failed to initialize Francis Byrne adapter:', error)
      throw new Error('Failed to initialize Francis Byrne adapter')
    }
  }

  private async initializeStripeSession(): Promise<void> {
    try {
      const stripeData = {
        muid: "e3117c75-8272-4872-868a-41c44298b42641020f",
        sid: "2a139586-2d6e-4d3c-aca8-0959e62da5e92490a3",
        url: "https://foreupsoftware.com/index.php/booking/22528/11078",
        source: "mouse-timings-10",
        data: [755,9,33,294,2087,9,8,11,5,10]
      }

      const response = await axios.post('https://m.stripe.com/6', stripeData, {
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8',
          'Origin': 'https://m.stripe.network',
          'Referer': 'https://m.stripe.network/',
          'Cookie': 'm=60d0acbe-7e03-4751-ae30-42e80e508dae78a672'
        }
      })

      const session: StripeSession = response.data
      this.sessionCookies = `__stripe_mid=${session.muid}; __stripe_sid=${session.sid}`
      
      console.log('Stripe session initialized')
    } catch (error) {
      console.error('Failed to initialize Stripe session:', error)
      throw error
    }
  }

  private async login(): Promise<void> {
    try {
      const loginData = new URLSearchParams({
        username: process.env['FRANCIS_BYRNE_USERNAME'] || '',
        password: process.env['FRANCIS_BYRNE_PASSWORD'] || '',
        booking_class_id: '',
        api_key: 'no_limits',
        course_id: '22528'
      })

      const response = await this.client.post('/index.php/api/booking/users/login', loginData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Origin': 'https://foreupsoftware.com',
          'Referer': 'https://foreupsoftware.com/index.php/booking/22528/11078',
          'Cookie': this.sessionCookies || ''
        }
      })

      const loginResponse: LoginResponse = response.data
      this.jwtToken = loginResponse.jwt
      this.bookingClassId = loginResponse.booking_class_ids[0] || 49772
      
      console.log('Login successful, JWT token obtained')
    } catch (error) {
      console.error('Failed to login:', error)
      throw error
    }
  }

  async searchTeeTimes(course: Course, params: SearchParams): Promise<TeeTime[]> {
    try {
      if (!this.jwtToken) {
        await this.initialize()
      }

      const dateStr = params.date.replace(/-/g, '-')
      console.log('dateStr', dateStr)
      const playerMin = params.players || 1;
      const queryParams = new URLSearchParams({
        time: 'all',
        date: dateStr,
        holes: 'all',
        players: playerMin.toString(),
        booking_class: this.bookingClassId.toString(),
        schedule_id: '11078', // Francis Byrne schedule ID
        specials_only: '0',
        api_key: 'no_limits'
      })

      // Add schedule IDs as separate parameters
      queryParams.append('schedule_ids[]', '11078') // Francis Byrne
      queryParams.append('schedule_ids[]', '11075') // Hendricks Field
      queryParams.append('schedule_ids[]', '11077') // Weequahic

      const response = await this.client.get(`/index.php/api/booking/times?${queryParams}`, {
        headers: {
          'X-Authorization': `Bearer ${this.jwtToken}`,
          'Cookie': this.sessionCookies || ''
        }
      })

      const teeTimeResponse: TeeTimeResponse = response.data

      console.log('teeTimeResponse', teeTimeResponse)
      
      return teeTimeResponse.filter(time => time.available_spots > playerMin)
        .map(time => ({
          id: `${time.schedule_id}_${time.time}`,
          courseId: course.id,
          date: params.date,
          time: time.time,
          availableSpots: params.players || 1,
          price: parseFloat(time.price) || 0,
          platformId: `${time.schedule_id}_${time.time}`,
          lastChecked: new Date(),
          createdAt: new Date()
        }))
    } catch (error) {
      console.error('Failed to search tee times:', error)
      throw new Error('Failed to search tee times')
    }
  }

  async bookTeeTime(course: Course, teeTime: TeeTime, params: BookingParams): Promise<Booking> {
    try {
      if (!this.jwtToken) {
        await this.initialize()
      }

      // Extract schedule ID and time from the tee time ID
      const [scheduleId, time] = teeTime.platformId.split('_')
      
      if (!scheduleId || !time) {
        throw new Error('Invalid tee time ID format')
      }

      const bookingData = new URLSearchParams({
        schedule_id: scheduleId,
        time: time,
        date: teeTime.date,
        players: params.players.toString(),
        holes: '18',
        booking_class_id: this.bookingClassId.toString(),
        api_key: 'no_limits'
      })

      const response = await this.client.post('/index.php/api/booking/reservations', bookingData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Authorization': `Bearer ${this.jwtToken}`,
          'Cookie': this.sessionCookies || ''
        }
      })

      if (response.data.success) {
        const booking: Booking = {
          id: response.data.booking_id || `booking_${Date.now()}`,
          userId: params.userInfo.email,
          courseId: course.id,
          teeTimeId: teeTime.id,
          status: 'confirmed',
          bookingDetails: {
            date: teeTime.date,
            time: teeTime.time,
            players: params.players,
            ...(teeTime.price && { price: teeTime.price })
          },
          platformResponse: response.data,
          createdAt: new Date(),
          updatedAt: new Date()
        }
        
        return booking
      } else {
        throw new Error(response.data.error || 'Booking failed')
      }
    } catch (error) {
      console.error('Failed to book tee time:', error)
      throw new Error('Failed to book tee time')
    }
  }

  async refreshToken(_course: Course): Promise<boolean> {
    try {
      await this.login()
      console.log('Token refreshed successfully')
      return true
    } catch (error) {
      console.error('Failed to refresh token:', error)
      return false
    }
  }

  async getCourseInfo(_course: Course): Promise<any> {
    return {
      name: 'Francis A. Byrne Golf Course',
      location: 'Newark, NJ',
      holes: 18,
      par: 72,
      length: '6,200 yards',
      website: 'https://foreupsoftware.com/index.php/booking/22528/11078',
      phone: '(973) 268-2600'
    }
  }

  getSupportedFeatures() {
    return {
      search: true,
      booking: true,
      cancellation: false,
      notifications: false,
      tokenRefresh: true
    }
  }
} 