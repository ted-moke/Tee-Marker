import { TeeTime } from '../types'
import { FOREUP_COURSE_ID } from '../constants'
import axios, { AxiosInstance } from 'axios'

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

export interface SearchParams {
  date: string
  players?: number
}

export class FrancisByrneAdapter {
  private client: AxiosInstance
  private jwtToken: string | null = null
  private sessionCookies: string | null = null
  private bookingClassId: number = 49772

  constructor() {
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
    await this.login()
    console.log('FrancisByrneAdapter initialized')
  }

  private async login(): Promise<void> {
    const loginData = new URLSearchParams({
      username: process.env['FRANCIS_BYRNE_USERNAME'] || '',
      password: process.env['FRANCIS_BYRNE_PASSWORD'] || '',
      booking_class_id: '',
      api_key: 'no_limits',
      course_id: FOREUP_COURSE_ID
    })

    const response = await this.client.post('/index.php/api/booking/users/login', loginData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': 'https://foreupsoftware.com',
        'Referer': `https://foreupsoftware.com/index.php/booking/${FOREUP_COURSE_ID}/11078`,
        'Cookie': this.sessionCookies || ''
      }
    })

    const loginResponse: LoginResponse = response.data
    this.jwtToken = loginResponse.jwt
    this.bookingClassId = loginResponse.booking_class_ids[0] || 49772
    console.log('Foreup login successful')
  }

  async searchTeeTimes(scheduleIds: string[], params: SearchParams): Promise<TeeTime[]> {
    if (!this.jwtToken) {
      await this.initialize()
    }

    const playerMin = params.players || 1
    const queryParams = new URLSearchParams({
      time: 'all',
      date: params.date,
      holes: 'all',
      players: playerMin.toString(),
      booking_class: this.bookingClassId.toString(),
      schedule_id: scheduleIds[0] || '11078',
      specials_only: '0',
      api_key: 'no_limits'
    })

    for (const id of scheduleIds) {
      queryParams.append('schedule_ids[]', id)
    }

    try {
      const response = await this.client.get(`/index.php/api/booking/times?${queryParams}`, {
        headers: {
          'X-Authorization': `Bearer ${this.jwtToken}`,
          'Cookie': this.sessionCookies || ''
        }
      })

      const teeTimeResponse: TeeTimeResponse = response.data

      return teeTimeResponse
        .filter(time => time.available_spots >= playerMin)
        .map(time => {
          const parsed = parseFloat(time.price)
          return {
            id: `${time.schedule_id}_${time.time}_${params.date}`,
            scheduleId: time.schedule_id.toString(),
            date: params.date,
            time: time.time,
            availableSpots: time.available_spots,
            ...(isNaN(parsed) ? {} : { price: parsed }),
          } as TeeTime
        })
    } catch (error: any) {
      // Retry once on auth failure
      if (error?.response?.status === 401) {
        console.log('JWT expired, refreshing...')
        await this.login()
        const retryResponse = await this.client.get(`/index.php/api/booking/times?${queryParams}`, {
          headers: {
            'X-Authorization': `Bearer ${this.jwtToken}`,
            'Cookie': this.sessionCookies || ''
          }
        })
        const retryData: TeeTimeResponse = retryResponse.data
        return retryData
          .filter(time => time.available_spots >= playerMin)
          .map(time => {
            const parsed = parseFloat(time.price)
            return {
              id: `${time.schedule_id}_${time.time}_${params.date}`,
              scheduleId: time.schedule_id.toString(),
              date: params.date,
              time: time.time,
              availableSpots: time.available_spots,
              ...(isNaN(parsed) ? {} : { price: parsed }),
            } as TeeTime
          })
      }
      throw error
    }
  }
}

export const francisByrneAdapter = new FrancisByrneAdapter()
