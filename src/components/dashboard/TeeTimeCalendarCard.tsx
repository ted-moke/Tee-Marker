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
}) => (
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
            <CalendarDayCard
              key={date}
              date={date}
              scheduleIds={preferences.scheduleIds}
              scheduledCheck={scheduledCheck}
              perCourse={perCourse}
            />
          )
        })}
      </div>
    )}
  </div>
)

export default TeeTimeCalendarCard
