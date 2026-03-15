import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, CheckCircle, AlertCircle, Play, Loader2, Search, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/api'

interface SchedulerStatus {
  isRunning: boolean
  lastCheck: string | null
  nextCheck: string | null
  lastCheckResult: {
    timesFound: number
    notified: number
    errors: string[]
  } | null
}

interface CheckRecord {
  id: string
  timestamp: string
  schedulesChecked: string[]
  timesFound: number
  notified: number
  errors: string[]
}

interface Preferences {
  scheduleIds: string[]
  daysOfWeek: number[]
  players: number
}

interface TeeTime {
  id: string
  scheduleId: string
  date: string
  time: string
  availableSpots: number
  price?: number
}

const SCHEDULE_NAMES: Record<string, string> = {
  '11078': 'Francis Byrne',
  '11075': 'Hendricks Field',
  '11077': 'Weequahic',
}

function fmt(ts: string | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleString()
}

function toYmd(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDateRange(daysAhead: number): string[] {
  const out: string[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i <= daysAhead; i += 1) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    out.push(toYmd(d))
  }

  return out
}

function parseTimeToMinutes(time: string): number {
  const clean = time.trim()
  const amPm = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)

  if (amPm) {
    let hours = parseInt(amPm[1]!, 10)
    const minutes = parseInt(amPm[2]!, 10)
    const meridiem = amPm[3]!.toUpperCase()
    if (meridiem === 'PM' && hours !== 12) hours += 12
    if (meridiem === 'AM' && hours === 12) hours = 0
    return hours * 60 + minutes
  }

  const twentyFourHour = clean.match(/^(\d{1,2}):(\d{2})$/)
  if (twentyFourHour) {
    const hours = parseInt(twentyFourHour[1]!, 10)
    const minutes = parseInt(twentyFourHour[2]!, 10)
    return hours * 60 + minutes
  }

  return Number.MAX_SAFE_INTEGER
}

function weekdayLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' })
}

function dateLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const Dashboard: React.FC = () => {
  const queryClient = useQueryClient()
  const [showRecentChecks, setShowRecentChecks] = useState(false)
  const dateRange = useMemo(() => getDateRange(14), [])

  const { data: statusRes } = useQuery({
    queryKey: ['status'],
    queryFn: () => api.get<{ success: boolean; data: SchedulerStatus }>('/status'),
    refetchInterval: 30_000,
  })

  const { data: historyRes } = useQuery({
    queryKey: ['history'],
    queryFn: () => api.get<{ success: boolean; data: CheckRecord[] }>('/history?limit=100'),
    refetchInterval: 60_000,
  })

  const { data: prefsRes, isLoading: preferencesLoading } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => api.get<{ success: boolean; data: Preferences }>('/preferences'),
  })

  const preferences = prefsRes?.data

  const { data: calendarData, isLoading: calendarLoading } = useQuery({
    queryKey: ['dashboard-calendar', preferences?.scheduleIds ?? [], preferences?.players ?? 1, dateRange],
    enabled: Boolean(preferences?.scheduleIds?.length),
    refetchInterval: 120_000,
    queryFn: async () => {
      const scheduleIds = preferences?.scheduleIds ?? []
      const players = preferences?.players ?? 1
      const requests = dateRange.flatMap(date =>
        scheduleIds.map(scheduleId => ({ date, scheduleId }))
      )

      const responses = await Promise.allSettled(
        requests.map(r =>
          api.get<{ success: boolean; data: TeeTime[] }>(
            `/tee-times/search?scheduleId=${r.scheduleId}&date=${r.date}&players=${players}`
          )
        )
      )

      const byDate: Record<string, Record<string, TeeTime | null>> = {}
      for (const date of dateRange) {
        byDate[date] = {}
        for (const scheduleId of scheduleIds) {
          byDate[date][scheduleId] = null
        }
      }

      responses.forEach((result, idx) => {
        if (result.status !== 'fulfilled') return
        const request = requests[idx]
        if (!request) return

        const earliest = result.value.data.reduce<TeeTime | null>((best, next) => {
          if (!best) return next
          return parseTimeToMinutes(next.time) < parseTimeToMinutes(best.time) ? next : best
        }, null)

        if (earliest) {
          byDate[request.date]![request.scheduleId] = earliest
        }
      })

      return byDate
    },
  })

  const runNow = useMutation({
    mutationFn: () => api.post('/scheduler/run'),
    onSuccess: () => {
      toast.success('Check completed')
      queryClient.invalidateQueries({ queryKey: ['status'] })
      queryClient.invalidateQueries({ queryKey: ['history'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const status = statusRes?.data
  const history = historyRes?.data ?? []
  const checksLast24h = history.filter(record => {
    const ts = new Date(record.timestamp).getTime()
    return ts >= Date.now() - 24 * 60 * 60 * 1000
  }).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Tee time monitoring status and recent activity</p>
      </div>

      {/* Status card */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Scheduler</h2>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            status?.isRunning ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {status?.isRunning ? 'Running' : 'Stopped'}
          </span>
        </div>

        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-gray-500">Last check</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">{fmt(status?.lastCheck ?? null)}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Next check</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">{fmt(status?.nextCheck ?? null)}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Last result</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {status?.lastCheckResult
                ? `${status.lastCheckResult.timesFound} found · ${status.lastCheckResult.notified} notified`
                : '—'}
            </dd>
          </div>
        </dl>

        <div className="mt-4">
          <button
            onClick={() => runNow.mutate()}
            disabled={runNow.isPending}
            className="btn btn-primary flex items-center"
          >
            {runNow.isPending
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking...</>
              : <><Play className="h-4 w-4 mr-2" /> Run Now</>
            }
          </button>
        </div>

        <div className="mt-5 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={() => setShowRecentChecks(prev => !prev)}
            className="w-full flex items-center justify-between rounded-md px-2 py-2 text-left hover:bg-gray-50"
          >
            <span className="text-sm font-medium text-gray-900">{checksLast24h} checks in the last 24h</span>
            {showRecentChecks
              ? <ChevronUp className="h-4 w-4 text-gray-500" />
              : <ChevronDown className="h-4 w-4 text-gray-500" />
            }
          </button>

          {showRecentChecks && (
            <div className="mt-2">
              {history.length === 0 ? (
                <div className="text-center py-6">
                  <Clock className="mx-auto h-10 w-10 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500">No checks run yet. Click Run Now to start.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.slice(0, 10).map(record => (
                    <div key={record.id} className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
                      <div className="flex items-start space-x-3">
                        {record.errors.length > 0
                          ? <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                          : <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
                        }
                        <div>
                          <p className="text-sm font-medium text-gray-900">{fmt(record.timestamp)}</p>
                          <p className="text-sm text-gray-500">
                            {record.schedulesChecked.map(id => SCHEDULE_NAMES[id] ?? id).join(', ')}
                          </p>
                          {record.errors.length > 0 && (
                            <p className="text-xs text-red-500 mt-1">{record.errors[0]}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-sm font-medium text-gray-900">{record.timesFound} found</p>
                        {record.notified > 0 && (
                          <p className="text-xs text-green-600">{record.notified} notified</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tee time calendar */}
      <div className="card">
        <h2 className="text-lg font-medium text-gray-900 mb-1">Tee Time Calendar</h2>
        <p className="text-sm text-gray-500 mb-4">Today through the next 14 days</p>

        {preferencesLoading || calendarLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
          </div>
        ) : !(preferences?.scheduleIds?.length) ? (
          <p className="text-sm text-gray-500">No monitored courses set. Configure courses in Preferences.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {dateRange.map(date => {
              const dayOfWeek = new Date(`${date}T00:00:00`).getDay()
              const scheduledCheck = (preferences.daysOfWeek ?? []).includes(dayOfWeek)
              const perCourse = calendarData?.[date] ?? {}

              return (
                <div key={date} className="rounded-lg border border-gray-200 p-3">
                  <p className="text-base font-semibold text-gray-900">{weekdayLabel(date)}</p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-500">
                    <span>{dateLabel(date)}</span>
                    {scheduledCheck && <Search className="h-3.5 w-3.5 text-gray-400" />}
                  </div>

                  <div className="mt-3 space-y-2">
                    {preferences.scheduleIds.map(scheduleId => {
                      const earliest = perCourse[scheduleId]
                      return (
                        <div key={scheduleId} className="rounded-md bg-gray-50 px-2 py-1.5">
                          <p className="text-xs text-gray-500">{SCHEDULE_NAMES[scheduleId] ?? scheduleId}</p>
                          {earliest ? (
                            <p className="text-sm font-medium text-gray-900">
                              {earliest.time} · {earliest.availableSpots} players
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400">No times</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
