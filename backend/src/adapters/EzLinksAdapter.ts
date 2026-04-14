import { Session, ClientIdentifier, initTLS } from 'node-tls-client'
import { TeeTime, Reservation } from '../types'
import { EZLINKS_COURSES } from '../constants'
import { SearchParams } from './FrancisByrneAdapter'

const BASE_URL = 'https://unioncounty14day.ezlinksgolf.com'
const RESERVATION_CACHE_TTL_MS = 5 * 60 * 1000

interface ReservationCache {
  reservations: Reservation[]
  fetchedAt: number
}

interface LoginResponse {
  IsSuccessful: boolean
  ContactID: number
  SessionID: string
  CsrfToken: string
  LoginStatus: number
  Error?: string | null
}

interface SearchRecord {
  r07: number
  r11: number
  r14: number
  r15: string
  r16: string
  r24: string
  r25: string
  r28: string
}

interface SearchResponse { r06?: SearchRecord[] }

interface OrderItem {
  ReservationTime: string
  ReservationDateTime?: string | null
  CourseName: string
  CourseID: number
  ConfirmationNumber: string
  Golfers: string
}

interface OrdersHistoryResponse {
  OrdersHistories?: OrderItem[]
  FutureOrders?: OrderItem[]
}

const BROWSER_HEADERS: Record<string, string> = {
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9',
  'origin': BASE_URL,
  'referer': `${BASE_URL}/index.html`,
  'sec-ch-ua': '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
}

function toEzLinksDate(date: string): string {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[2]}/${m[3]}/${m[1]}` : date
}

function isoToTime(iso: string): string {
  const m = iso.match(/T(\d{2}):(\d{2})/)
  return m ? `${m[1]}:${m[2]}` : iso
}

function isoToDate(iso: string): string {
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1]! : ''
}

function parseReservationDateTime(raw: string): { date: string; time: string } | null {
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return null
  const [, mo, d, y, h, min, ap] = m
  let hour = parseInt(h!, 10)
  if (ap!.toUpperCase() === 'PM' && hour !== 12) hour += 12
  if (ap!.toUpperCase() === 'AM' && hour === 12) hour = 0
  return {
    date: `${y}-${mo!.padStart(2, '0')}-${d!.padStart(2, '0')}`,
    time: `${String(hour).padStart(2, '0')}:${min}`,
  }
}

function parseCookieOverride(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 1) continue
    const k = part.slice(0, eq).trim()
    const v = part.slice(eq + 1).trim()
    if (k) out[k] = v
  }
  return out
}

export class EzLinksAdapter {
  private session: Session | null = null
  private sessionReady = false
  private contactId: number | null = null
  private reservationCache: ReservationCache | null = null

  private async getSession(): Promise<Session> {
    if (this.session) return this.session
    await initTLS()
    this.session = new Session({
      clientIdentifier: ClientIdentifier.chrome_131,
      timeout: 20000,
    })
    return this.session
  }

  private cookieOverride(): Record<string, string> | null {
    const raw = process.env['EZLINKS_COOKIE_OVERRIDE']?.trim()
    return raw ? parseCookieOverride(raw) : null
  }

  async initialize(_courseId?: string): Promise<void> {
    await this.getSession()
    if (this.cookieOverride()) {
      console.log('[EzLinks] Using EZLINKS_COOKIE_OVERRIDE — skipping login')
      this.sessionReady = true
      return
    }
    const hasUsername = Boolean(process.env['EZLINKS_USERNAME'])
    const hasPassword = Boolean(process.env['EZLINKS_PASSWORD'])
    console.log(`[EzLinks] Initializing adapter (username set: ${hasUsername}, password set: ${hasPassword})`)
    await this.login()
    console.log('EzLinksAdapter initialized')
  }

  private async login(): Promise<void> {
    if (this.cookieOverride()) {
      this.sessionReady = true
      return
    }
    const session = await this.getSession()
    const username = process.env['EZLINKS_USERNAME'] || ''
    const password = process.env['EZLINKS_PASSWORD'] || ''

    const response = await session.post(`${BASE_URL}/api/login/login`, {
      headers: {
        ...BROWSER_HEADERS,
        'content-type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({ Login: username, Password: password, MasterSponsorID: '4864', SessionID: '' }),
    })

    if (!response.ok) {
      throw new Error(`EzLinks login HTTP ${response.status}: ${response.body.slice(0, 300)}`)
    }

    const data = await response.json<LoginResponse>()
    if (!data.IsSuccessful) {
      throw new Error(`EzLinks login failed: ${data.Error ?? 'unknown error'} (status=${data.LoginStatus})`)
    }

    this.contactId = data.ContactID
    this.sessionReady = true
    this.reservationCache = null
    console.log(`[EzLinks] Login successful (contactId: ${this.contactId})`)
  }

  async searchTeeTimes(courseIds: string[], params: SearchParams): Promise<TeeTime[]> {
    if (!this.sessionReady) await this.initialize()
    const session = await this.getSession()

    const playerMin = params.players || 1
    const body = {
      p01: courseIds.map(id => parseInt(id, 10)).filter(n => !Number.isNaN(n)),
      p02: toEzLinksDate(params.date),
      p03: '5:00 AM',
      p04: '8:00 PM',
      p05: 0,
      p06: 4,
      p07: false,
    }

    console.log('[EzLinks] Search request', JSON.stringify({ courseIds, date: params.date, players: playerMin, body }))

    const doSearch = () => session.post(`${BASE_URL}/api/search/search`, {
      headers: { ...BROWSER_HEADERS, 'content-type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(body),
      ...(this.cookieOverride() ? { cookies: this.cookieOverride()! } : {}),
    })

    let response = await doSearch()
    if ((response.status === 401 || response.status === 403) && !this.cookieOverride()) {
      console.log(`[EzLinks] Search got ${response.status}, re-logging in and retrying once...`)
      await this.login()
      response = await doSearch()
    }

    if (!response.ok) {
      const snippet = response.body.slice(0, 300)
      console.error(`[EzLinks] Search failed status=${response.status} body=${snippet}`)
      throw new Error(`EzLinks search HTTP ${response.status}`)
    }

    const data = await response.json<SearchResponse>()
    return this.mapSearchResponse(data, params.date, playerMin)
  }

  private mapSearchResponse(data: SearchResponse, requestedDate: string, playerMin: number): TeeTime[] {
    const records = Array.isArray(data.r06) ? data.r06 : []
    console.log(
      '[EzLinks] Search response',
      JSON.stringify({
        requestedDate,
        rawCount: records.length,
        sample: records.slice(0, 3).map(r => ({ courseId: r.r07, time: r.r24, available: r.r14, price: r.r25 })),
      })
    )

    return records
      .filter(r => (r.r14 ?? 0) >= playerMin)
      .map(r => {
        const courseId = String(r.r07)
        const date = isoToDate(r.r15) || requestedDate
        const time = r.r24 || isoToTime(r.r15)
        const priceNum = parseFloat(r.r25)
        const teeTime: TeeTime = {
          id: `ezlinks_${courseId}_${date}_${time}`,
          source: 'ezlinks',
          scheduleId: courseId,
          scheduleName: r.r16 || EZLINKS_COURSES[courseId] || courseId,
          date,
          time,
          availableSpots: r.r14,
          ...(Number.isFinite(priceNum) ? { price: priceNum } : {}),
        }
        return teeTime
      })
  }

  async fetchReservations(forceRefresh = false): Promise<Reservation[]> {
    const now = Date.now()
    if (!forceRefresh && this.reservationCache && now - this.reservationCache.fetchedAt < RESERVATION_CACHE_TTL_MS) {
      return this.reservationCache.reservations
    }

    if (!this.sessionReady) await this.initialize()
    const session = await this.getSession()

    const doFetch = () => session.get(`${BASE_URL}/api/account/ordershistory`, {
      headers: BROWSER_HEADERS,
      ...(this.cookieOverride() ? { cookies: this.cookieOverride()! } : {}),
    })

    let response = await doFetch()
    if ((response.status === 401 || response.status === 403) && !this.cookieOverride()) {
      await this.login()
      response = await doFetch()
    }
    if (!response.ok) {
      console.error(`[EzLinks] Reservations fetch failed status=${response.status} body=${response.body.slice(0, 300)}`)
      throw new Error(`EzLinks reservations HTTP ${response.status}`)
    }

    const data = await response.json<OrdersHistoryResponse>()
    const future = data.FutureOrders ?? []
    const today = new Date().toISOString().split('T')[0]!
    const reservations = future
      .map(o => this.mapReservation(o))
      .filter((r): r is Reservation => r !== null && r.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))

    console.log(`[EzLinks] Mapped ${reservations.length}/${future.length} future reservations`)
    this.reservationCache = { reservations, fetchedAt: now }
    return reservations
  }

  private mapReservation(raw: OrderItem): Reservation | null {
    const dt = raw.ReservationDateTime ? parseReservationDateTime(raw.ReservationDateTime) : null
    if (!dt) return null
    const courseId = String(raw.CourseID)
    return {
      id: String(raw.ConfirmationNumber),
      source: 'ezlinks',
      scheduleId: courseId,
      scheduleName: raw.CourseName || EZLINKS_COURSES[courseId] || courseId,
      date: dt.date,
      time: dt.time,
      players: parseInt(raw.Golfers, 10) || 1,
      status: 'confirmed',
    }
  }
}

export const ezLinksAdapter = new EzLinksAdapter()
