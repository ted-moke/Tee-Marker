import React from 'react'
import { Loader2, RefreshCw, Send } from 'lucide-react'
import type { Reservation } from '@/components/dashboard/types'

interface EmptyWeek {
  weekStart: string   // YYYY-MM-DD (Monday)
  label: string
}

interface ReservationsCardProps {
  reservations: Reservation[] | undefined
  isLoading: boolean
  emptyWeeks: EmptyWeek[]
  onRefresh: () => void
  refreshPending: boolean
  onSendDigest: () => void
  digestPending: boolean
}

function formatRelativeDay(isoDate: string): string {
  const target = new Date(`${isoDate}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000)

  const weekday = target.toLocaleDateString('en-US', { weekday: 'short' })
  const monthDay = target.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })

  if (diff === 0) return `Today (${weekday} ${monthDay})`
  if (diff === 1) return `Tomorrow (${weekday} ${monthDay})`
  return `${weekday} ${monthDay}`
}

function formatTime(raw: string): string {
  const trimmed = raw.trim()
  const v = trimmed.split(/[ T]/).pop()?.trim() || trimmed
  const m24 = v.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (m24) {
    const hour = parseInt(m24[1]!, 10)
    const min = m24[2]!
    const suffix = hour >= 12 ? 'PM' : 'AM'
    const h12 = hour % 12 === 0 ? 12 : hour % 12
    return `${h12}:${min} ${suffix}`
  }
  return v
}

const ReservationsCard: React.FC<ReservationsCardProps> = ({
  reservations,
  isLoading,
  emptyWeeks,
  onRefresh,
  refreshPending,
  onSendDigest,
  digestPending,
}) => {
  const hasReservations = reservations && reservations.length > 0

  return (
    <div className="card p-3 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-medium text-gray-900">My Tee Times</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={onSendDigest}
            disabled={digestPending || isLoading}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
          >
            {digestPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send to Discord
          </button>
          <button
            onClick={onRefresh}
            disabled={refreshPending || isLoading}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            {refreshPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading reservations…
        </div>
      ) : (
        <div className="space-y-1.5">
          {hasReservations ? (
            reservations.map(r => (
              <div key={r.id} className="flex items-center justify-between rounded-md bg-green-50 px-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-gray-900">{formatRelativeDay(r.date)}</span>
                  <span className="text-gray-500 ml-2">{formatTime(r.time)}</span>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <span>{r.scheduleName} · {r.players}p</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-400 py-1">No upcoming reservations.</p>
          )}

          {emptyWeeks.length > 0 && (
            <div className="mt-2 space-y-1">
              {emptyWeeks.map(ew => (
                <div key={ew.weekStart} className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-700">
                  <span className="font-medium">⚠️</span>
                  <span>No tee time booked — week of {ew.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ReservationsCard
