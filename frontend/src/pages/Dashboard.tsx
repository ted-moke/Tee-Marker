import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '@/api'
import SchedulerCard from '@/components/dashboard/SchedulerCard'
import TeeTimeCalendarCard from '@/components/dashboard/TeeTimeCalendarCard'
import ReservationsCard from '@/components/dashboard/ReservationsCard'
import { getDateRange, parseTimeToMinutes } from '@/components/dashboard/utils'
import type { SchedulerStatus, CheckRecord, Preferences, TeeTime, CalendarData, Reservation } from '@/components/dashboard/types'

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
    queryKey: ['dashboard-calendar', preferences?.scheduleIds ?? [], dateRange],
    enabled: Boolean(preferences?.scheduleIds?.length),
    refetchInterval: 120_000,
    queryFn: async () => {
      const scheduleIds = preferences?.scheduleIds ?? []

      const res = await api.get<{ success: boolean; data: TeeTime[] }>(
        `/tee-times/active?scheduleIds=${scheduleIds.join(',')}&dates=${dateRange.join(',')}`
      )

      const byDate: CalendarData = {}
      for (const date of dateRange) {
        byDate[date] = {}
        for (const scheduleId of scheduleIds) {
          byDate[date][scheduleId] = { earliest: null, additionalCount: 0, allTimes: [] }
        }
      }

      for (const t of res.data) {
        const bucket = byDate[t.date]?.[t.scheduleId]
        if (!bucket) continue
        bucket.allTimes.push(t)
      }

      for (const date of dateRange) {
        for (const scheduleId of scheduleIds) {
          const bucket = byDate[date]![scheduleId]!
          bucket.allTimes.sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time))
          bucket.earliest = bucket.allTimes[0] ?? null
          bucket.additionalCount = Math.max(0, bucket.allTimes.length - 1)
        }
      }

      return byDate
    },
  })

  const { data: reservationsRes, isLoading: reservationsLoading } = useQuery({
    queryKey: ['reservations'],
    queryFn: () => api.get<{ success: boolean; data: Reservation[] }>('/reservations'),
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  })

  const refreshReservations = useMutation({
    mutationFn: () => api.post<{ success: boolean; data: Reservation[] }>('/reservations/refresh'),
    onSuccess: (res) => {
      queryClient.setQueryData(['reservations'], res)
      toast.success('Reservations refreshed')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const sendDigest = useMutation({
    mutationFn: () => api.post('/reservations/digest'),
    onSuccess: () => toast.success('Digest sent to Discord'),
    onError: (err: Error) => toast.error(err.message),
  })

  const reservations = reservationsRes?.data ?? []

  const emptyWeeks = useMemo(() => {
    if (!preferences?.specificDates) return []
    const bookedDates = new Set(reservations.map(r => r.date))

    const getWeekStart = (d: Date): Date => {
      const copy = new Date(d)
      copy.setHours(0, 0, 0, 0)
      const day = copy.getDay()
      copy.setDate(copy.getDate() - (day === 0 ? 6 : day - 1))
      return copy
    }

    const toISO = (d: Date) => d.toISOString().split('T')[0]!

    const thisWeek = getWeekStart(new Date())
    return Array.from({ length: 3 }, (_, i) => {
      const ws = new Date(thisWeek)
      ws.setDate(ws.getDate() + i * 7)
      const wsStr = toISO(ws)
      const weDate = new Date(ws)
      weDate.setDate(weDate.getDate() + 6)
      const weStr = toISO(weDate)
      const playDates = preferences.specificDates.filter(d => d >= wsStr && d <= weStr)
      if (playDates.length === 0 || playDates.some(d => bookedDates.has(d))) return null
      const label = ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return { weekStart: wsStr, label }
    }).filter((w): w is { weekStart: string; label: string } => w !== null)
  }, [reservations, preferences?.specificDates])

  const runNow = useMutation({
    mutationFn: () => api.post('/scheduler/run'),
    onSuccess: () => {
      toast.success('Check completed')
      queryClient.invalidateQueries({ queryKey: ['status'] })
      queryClient.invalidateQueries({ queryKey: ['history'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const sendWeatherOutlook = useMutation({
    mutationFn: () => api.post<{ success: boolean; data?: { sent: boolean } }>('/scheduler/weather-outlook'),
    onSuccess: (res) => {
      if (res.data?.sent) {
        toast.success('14-day weather outlook sent to Discord')
      } else {
        toast('Weather outlook was skipped')
      }
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const sendCurrentTeeTimesTest = useMutation({
    mutationFn: () =>
      api.post<{
        success: boolean
        data?: { sent: boolean; notified: number; reason?: string; errors: string[] }
      }>('/scheduler/test-tee-times'),
    onSuccess: (res) => {
      const payload = res.data
      if (payload?.sent) {
        toast.success(`Sent ${payload.notified} tee time${payload.notified === 1 ? '' : 's'} to Discord`)
        return
      }
      toast(payload?.reason ?? 'No tee times were sent')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const [ezLinksTestResults, setEzLinksTestResults] = useState<Array<{ date: string; status: string; count?: number; error?: string; elapsed?: number }> | null>(null)

  const testEzLinks = useMutation({
    mutationFn: (dates: number) =>
      api.post<{
        success: boolean
        data: { results: Array<{ date: string; status: string; count?: number; error?: string; elapsed?: number }> }
      }>('/scheduler/test-ezlinks', { dates }),
    onSuccess: (res) => {
      setEzLinksTestResults(res.data.results)
      const ok = res.data.results.filter(r => r.status === 'ok').length
      const fail = res.data.results.filter(r => r.status === 'error').length
      if (fail === 0) toast.success(`All ${ok} dates returned OK`)
      else toast.error(`${fail}/${ok + fail} dates failed`)
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
    <div className="space-y-3">
      <SchedulerCard
        status={status}
        runNowPending={runNow.isPending}
        onRunNow={() => runNow.mutate()}
        runWeatherOutlookPending={sendWeatherOutlook.isPending}
        onRunWeatherOutlook={() => sendWeatherOutlook.mutate()}
        runTestTeeTimesPending={sendCurrentTeeTimesTest.isPending}
        onRunTestTeeTimes={() => sendCurrentTeeTimesTest.mutate()}
        testEzLinksPending={testEzLinks.isPending}
        onTestEzLinks={(dates: number) => testEzLinks.mutate(dates)}
        ezLinksTestResults={ezLinksTestResults}
        checksLast24h={checksLast24h}
        showRecentChecks={showRecentChecks}
        onToggleRecentChecks={() => setShowRecentChecks(prev => !prev)}
        history={history}
      />

      <ReservationsCard
        reservations={reservationsRes?.data}
        isLoading={reservationsLoading}
        emptyWeeks={emptyWeeks}
        onRefresh={() => refreshReservations.mutate()}
        refreshPending={refreshReservations.isPending}
        onSendDigest={() => sendDigest.mutate()}
        digestPending={sendDigest.isPending}
      />

      <TeeTimeCalendarCard
        preferencesLoading={preferencesLoading}
        calendarLoading={calendarLoading}
        preferences={preferences}
        dateRange={dateRange}
        calendarData={calendarData}
        reservations={reservations}
        lastCheck={status?.lastCheck}
      />
    </div>
  )
}

export default Dashboard
