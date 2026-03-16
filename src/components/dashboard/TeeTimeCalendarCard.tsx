import React from 'react'
import { Loader2 } from 'lucide-react'
import CalendarDayCard from '@/components/dashboard/CalendarDayCard'
import type { Preferences, CalendarData } from '@/components/dashboard/types'

interface TeeTimeCalendarCardProps {
  preferencesLoading: boolean
  calendarLoading: boolean
  preferences?: Preferences
  dateRange: string[]
  calendarData?: CalendarData
}

const TeeTimeCalendarCard: React.FC<TeeTimeCalendarCardProps> = ({
  preferencesLoading,
  calendarLoading,
  preferences,
  dateRange,
  calendarData,
}) => {
  const scheduledDays = dateRange.filter(date => {
    const dayOfWeek = new Date(`${date}T00:00:00`).getDay()
    return (preferences?.daysOfWeek ?? []).includes(dayOfWeek)
  })

  return (
    <div className="card p-3 sm:p-4">
      <h2 className="text-base font-medium text-gray-900 mb-2">Tee Time Calendar</h2>

      {preferencesLoading || calendarLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : !(preferences?.scheduleIds?.length) ? (
        <p className="text-sm text-gray-500">No monitored courses set. Configure courses in Preferences.</p>
      ) : scheduledDays.length === 0 ? (
        <p className="text-sm text-gray-500">No scheduled check days in this date range.</p>
      ) : (
        <div className="space-y-1.5">
          {scheduledDays.map((date, idx) => {
            const prevDate = idx > 0 ? scheduledDays[idx - 1] : null
            const gap = prevDate
              ? Math.max(
                  0,
                  Math.round(
                    (new Date(`${date}T00:00:00`).getTime() - new Date(`${prevDate}T00:00:00`).getTime()) / (24 * 60 * 60 * 1000)
                  ) - 1
                )
              : 0
            const perCourse = calendarData?.[date] ?? {}

            return (
              <React.Fragment key={date}>
                {gap > 0 && (
                  <div className="w-full flex items-center justify-center py-0.5 text-gray-400 text-sm tracking-wide">
                    {'• '.repeat(gap).trim()}
                  </div>
                )}
                <div className="w-full">
                  <CalendarDayCard
                    date={date}
                    scheduleIds={preferences.scheduleIds}
                    scheduledCheck
                    perCourse={perCourse}
                  />
                </div>
              </React.Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default TeeTimeCalendarCard
