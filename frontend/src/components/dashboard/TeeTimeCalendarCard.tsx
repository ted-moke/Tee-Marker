import React, { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import CalendarDayCell from '@/components/dashboard/CalendarDayCell'
import CourseTimesPopover from '@/components/dashboard/CourseTimesPopover'
import { DEFAULT_WEATHER_THRESHOLDS } from '@/components/dashboard/types'
import type { Preferences, CalendarData, Reservation, CourseDaySummary } from '@/components/dashboard/types'

interface TeeTimeCalendarCardProps {
  preferencesLoading: boolean
  calendarLoading: boolean
  preferences?: Preferences
  dateRange: string[]
  calendarData?: CalendarData
  reservations?: Reservation[]
  lastCheck?: string | null
}

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function mondayIndex(dateStr: string): number {
  const day = new Date(`${dateStr}T00:00:00`).getDay()
  return day === 0 ? 6 : day - 1
}

function todayYmd(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function formatRelative(iso: string | null | undefined): string | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms) || ms < 0) return null
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

const TeeTimeCalendarCard: React.FC<TeeTimeCalendarCardProps> = ({
  preferencesLoading,
  calendarLoading,
  preferences,
  dateRange,
  calendarData,
  reservations,
  lastCheck,
}) => {
  const [selected, setSelected] = useState<{ date: string; scheduleId: string } | null>(null)

  const lastCheckLabel = formatRelative(lastCheck)
  const today = todayYmd()
  const scheduledDates = useMemo(
    () => new Set(preferences?.specificDates ?? []),
    [preferences?.specificDates],
  )
  const reservationByDate = useMemo(() => {
    const map = new Map<string, Reservation>()
    for (const r of reservations ?? []) {
      if (!map.has(r.date)) map.set(r.date, r)
    }
    return map
  }, [reservations])

  const padCount = dateRange.length > 0 ? mondayIndex(dateRange[0]!) : 0
  const thresholds = preferences?.weatherThresholds ?? DEFAULT_WEATHER_THRESHOLDS

  const selectedSummary: CourseDaySummary | null = selected
    ? calendarData?.[selected.date]?.[selected.scheduleId] ?? null
    : null

  return (
    <div className="card p-3 sm:p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-medium text-gray-900">Tee Time Calendar</h2>
        {lastCheckLabel && (
          <span className="text-xs text-gray-500">Last checked {lastCheckLabel}</span>
        )}
      </div>

      {preferencesLoading || calendarLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : !(preferences?.scheduleIds?.length) ? (
        <p className="text-sm text-gray-500">No monitored courses set. Configure courses in Preferences.</p>
      ) : (
        <div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAY_HEADERS.map(label => (
              <div
                key={label}
                className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-gray-500 text-center"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="relative grid grid-cols-7 gap-1">
            {Array.from({ length: padCount }).map((_, i) => (
              <div key={`pad-${i}`} className="min-h-[80px] sm:min-h-[110px]" aria-hidden="true" />
            ))}

            {dateRange.map(date => {
              const perCourse = calendarData?.[date] ?? {}
              const isMonitored = scheduledDates.has(date)
              const isToday = date === today
              const reservation = reservationByDate.get(date)
              const selectedScheduleId = selected?.date === date ? selected.scheduleId : null

              return (
                <div key={date} className="relative">
                  <CalendarDayCell
                    date={date}
                    scheduleIds={preferences.scheduleIds}
                    perCourse={perCourse}
                    isMonitored={isMonitored}
                    isToday={isToday}
                    reservation={reservation}
                    selectedScheduleId={selectedScheduleId}
                    onChipClick={(scheduleId) =>
                      setSelected(prev =>
                        prev && prev.date === date && prev.scheduleId === scheduleId
                          ? null
                          : { date, scheduleId }
                      )
                    }
                  />
                  {selected?.date === date && selectedSummary && (
                    <CourseTimesPopover
                      date={selected.date}
                      scheduleId={selected.scheduleId}
                      summary={selectedSummary}
                      thresholds={thresholds}
                      onClose={() => setSelected(null)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default TeeTimeCalendarCard
