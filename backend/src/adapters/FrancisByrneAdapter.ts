import { TeeTime } from '../types'
import { FOREUP_COURSE_BY_SCHEDULE } from '../constants'
import axios, { AxiosError, AxiosInstance } from 'axios'

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

const DEFAULT_FOREUP_COURSE_ID = '22528'
const PREFERRED_BOOKING_CLASS_ID = '49772'

function toForeUpDate(date: string): string {
  const iso = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    return `${iso[2]}-${iso[3]}-${iso[1]}`
  }
  return date
}

export class FrancisByrneAdapter {
  private client: AxiosInstance
  private jwtToken: string | null = null
  private sessionCookies: string | null = null
  private bookingClassId: number = 49772
  private authenticatedScheduleId: string | null = null

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

  async initialize(scheduleId: string): Promise<void> {
    const hasUsername = Boolean(process.env['FRANCIS_BYRNE_USERNAME'])
    const hasPassword = Boolean(process.env['FRANCIS_BYRNE_PASSWORD'])
    console.log(`[ForeUp] Initializing adapter (username set: ${hasUsername}, password set: ${hasPassword})`)
    await this.login(scheduleId)
    console.log('FrancisByrneAdapter initialized')
  }

  private async login(scheduleId: string): Promise<void> {
    const courseId = FOREUP_COURSE_BY_SCHEDULE[scheduleId] ?? DEFAULT_FOREUP_COURSE_ID

    const loginData = new URLSearchParams({
      username: process.env['FRANCIS_BYRNE_USERNAME'] || '',
      password: process.env['FRANCIS_BYRNE_PASSWORD'] || '',
      booking_class_id: '',
      api_key: 'no_limits',
      course_id: courseId
    })

    try {
      const response = await this.client.post('/index.php/api/booking/users/login', loginData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Origin': 'https://foreupsoftware.com',
          'Referer': `https://foreupsoftware.com/index.php/booking/${courseId}/${scheduleId}`,
          'Cookie': this.sessionCookies || ''
        }
      })

      const loginResponse: LoginResponse = response.data
      const setCookie = response.headers['set-cookie']
      if (Array.isArray(setCookie) && setCookie.length > 0) {
        // Keep only cookie key=value pairs for subsequent requests.
        this.sessionCookies = setCookie.map(cookie => cookie.split(';')[0]).join('; ')
      }

      this.jwtToken = loginResponse.jwt
      this.bookingClassId = loginResponse.booking_class_ids[0] || 49772
      this.authenticatedScheduleId = scheduleId
      console.log(
        `[ForeUp] Login successful (user_id: ${loginResponse.user_id}, courseId: ${courseId}, scheduleId: ${scheduleId}, bookingClassId: ${this.bookingClassId}, hasJwt: ${Boolean(this.jwtToken)}, cookieCount: ${setCookie?.length || 0})`
      )
    } catch (error: unknown) {
      this.logHttpError('Login failed', error, { courseId, scheduleId })
      throw error
    }
  }

  async searchTeeTimes(scheduleIds: string[], params: SearchParams): Promise<TeeTime[]> {
    const primaryScheduleId = scheduleIds[0] || '11078'
    const courseId = FOREUP_COURSE_BY_SCHEDULE[primaryScheduleId] ?? DEFAULT_FOREUP_COURSE_ID

    if (!this.jwtToken || this.authenticatedScheduleId !== primaryScheduleId) {
      await this.initialize(primaryScheduleId)
    }

    const playerMin = params.players || 1
    const foreUpDate = toForeUpDate(params.date)
    const queryParams = new URLSearchParams({
      time: 'all',
      date: foreUpDate,
      holes: 'all',
      // ForeUp returns fuller inventories with players=0 (Any); we filter by min players locally.
      players: '0',
      booking_class: PREFERRED_BOOKING_CLASS_ID,
      schedule_id: primaryScheduleId,
      specials_only: '0',
      api_key: 'no_limits'
    })

    for (const id of scheduleIds) {
      queryParams.append('schedule_ids[]', id)
    }
    const requestPath = `/index.php/api/booking/times?${queryParams.toString()}`
    console.log(
      '[ForeUp] Times request',
      JSON.stringify({
        scheduleId: primaryScheduleId,
        courseId,
        date: params.date,
        foreUpDate,
        requestedPlayers: playerMin,
        apiPlayers: 0,
        requestPath,
        bookingClassId: PREFERRED_BOOKING_CLASS_ID,
      })
    )

    try {
      const response = await this.client.get(requestPath, {
        headers: {
          'X-Authorization': `Bearer ${this.jwtToken}`,
          'Cookie': this.sessionCookies || ''
        }
      })

      const teeTimeResponse: TeeTimeResponse = Array.isArray(response.data) ? response.data : []
      console.log(
        '[ForeUp] Times response',
        JSON.stringify({
          scheduleId: primaryScheduleId,
          date: params.date,
          foreUpDate,
          httpStatus: response.status,
          rawCount: teeTimeResponse.length,
          sample: teeTimeResponse.slice(0, 3).map(t => ({
            time: t.time,
            available_spots: t.available_spots,
            booking_class_id: t.booking_class_id,
            schedule_id: t.schedule_id,
            price: t.price,
          })),
        })
      )

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
      this.logHttpError('Initial tee time request failed', error, {
        date: params.date,
        foreUpDate,
        scheduleIds,
        playerMin,
        apiPlayers: 0,
        bookingClassId: PREFERRED_BOOKING_CLASS_ID
      })

      // Retry once on auth failure
      if (error?.response?.status === 401) {
        console.log('[ForeUp] Received 401 on tee time request, refreshing login and retrying once...')
        await this.login(primaryScheduleId)
        try {
          const retryResponse = await this.client.get(requestPath, {
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
        } catch (retryError: unknown) {
          this.logHttpError('Retry tee time request failed', retryError, {
            date: params.date,
            foreUpDate,
            scheduleIds,
            playerMin,
            apiPlayers: 0,
            bookingClassId: PREFERRED_BOOKING_CLASS_ID
          })
          throw retryError
        }
      }
      throw error
    }
  }

  private logHttpError(context: string, error: unknown, extra?: Record<string, unknown>): void {
    if (!axios.isAxiosError(error)) {
      console.error(`[ForeUp] ${context}:`, error)
      return
    }

    const axiosError = error as AxiosError
    const status = axiosError.response?.status
    const statusText = axiosError.response?.statusText
    const responseHeaders = this.redactHeaders(axiosError.response?.headers as Record<string, unknown> | undefined)
    const requestHeaders = this.redactHeaders(axiosError.config?.headers as Record<string, unknown> | undefined)
    const responseData = this.safelySerialize(axiosError.response?.data)

    console.error(
      `[ForeUp] ${context}: ${axiosError.message}`,
      JSON.stringify({
        status,
        statusText,
        method: axiosError.config?.method,
        url: axiosError.config?.url,
        requestHeaders,
        responseHeaders,
        responseData,
        hasJwt: Boolean(this.jwtToken),
        hasSessionCookies: Boolean(this.sessionCookies),
        ...extra,
      })
    )
  }

  private redactHeaders(headers?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!headers) return undefined

    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(headers)) {
      const key = k.toLowerCase()
      if (key === 'authorization' || key === 'x-authorization' || key === 'cookie' || key === 'set-cookie') {
        out[k] = '[REDACTED]'
      } else {
        out[k] = v
      }
    }
    return out
  }

  private safelySerialize(value: unknown): unknown {
    if (typeof value === 'string') return value
    if (value === null || value === undefined) return value
    try {
      return JSON.parse(JSON.stringify(value))
    } catch {
      return String(value)
    }
  }
}

export const francisByrneAdapter = new FrancisByrneAdapter()
