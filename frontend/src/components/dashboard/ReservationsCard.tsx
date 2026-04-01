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
  const getWeekStart = (dateStr: string): string => {
    const d = new Date(`${dateStr}T00:00:00`)
    const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    return d.toISOString().split('T')[0]!
  }

  type RowItem =
    | { kind: 'reservation'; sortKey: string; r: Reservation }
    | { kind: 'empty'; sortKey: string; ew: EmptyWeek }

  // Group by week, sorted chronologically
  const weekMap = new Map<string, RowItem[]>()
  const ensureWeek = (ws: string) => {
    if (!weekMap.has(ws)) weekMap.set(ws, [])
    return weekMap.get(ws)!
  }
  for (const r of (reservations ?? [])) {
    ensureWeek(getWeekStart(r.date)).push({ kind: 'reservation', sortKey: r.date, r })
  }
  for (const ew of emptyWeeks) {
    ensureWeek(ew.weekStart).push({ kind: 'empty', sortKey: ew.weekStart, ew })
  }
  const sortedWeeks = [...weekMap.entries()].sort(([a], [b]) => a.localeCompare(b))

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
      ) : sortedWeeks.length === 0 ? (
        <p className="text-sm text-gray-400 py-1">No upcoming reservations.</p>
      ) : (
        <div className="space-y-3">
          {sortedWeeks.map(([ws, items]) => {
            const d = new Date(`${ws}T00:00:00`)
            const weekLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            return (
              <div key={ws}>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Week of {weekLabel}</p>
                <div className="space-y-1">
                  {items.sort((a, b) => a.sortKey.localeCompare(b.sortKey)).map(row =>
                    row.kind === 'reservation' ? (
                      <div key={row.r.id} className="flex items-center justify-between rounded-md bg-green-50 px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium text-gray-900">{formatRelativeDay(row.r.date)}</span>
                          <span className="text-gray-500 ml-2">{formatTime(row.r.time)}</span>
                        </div>
                        <div className="text-right text-xs text-gray-500">
                          <span>{row.r.scheduleName} · {row.r.players}p</span>
                        </div>
                      </div>
                    ) : (
                      <div key={row.ew.weekStart} className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-700">
                        <span>⚠️</span>
                        <span>No tee time booked</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ReservationsCard
