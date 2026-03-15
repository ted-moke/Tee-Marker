import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '@/api'
import SchedulerCard from '@/components/dashboard/SchedulerCard'
import TeeTimeCalendarCard from '@/components/dashboard/TeeTimeCalendarCard'
import { getDateRange, parseTimeToMinutes } from '@/components/dashboard/utils'
import type { SchedulerStatus, CheckRecord, Preferences, TeeTime, CalendarData } from '@/components/dashboard/types'

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

      const byDate: CalendarData = {}
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

      <SchedulerCard
        status={status}
        runNowPending={runNow.isPending}
        onRunNow={() => runNow.mutate()}
        checksLast24h={checksLast24h}
        showRecentChecks={showRecentChecks}
        onToggleRecentChecks={() => setShowRecentChecks(prev => !prev)}
        history={history}
      />

      <TeeTimeCalendarCard
        preferencesLoading={preferencesLoading}
        calendarLoading={calendarLoading}
        preferences={preferences}
        dateRange={dateRange}
        calendarData={calendarData}
      />
    </div>
  )
}

export default Dashboard
