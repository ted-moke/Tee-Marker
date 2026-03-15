import React from 'react'
import { Search } from 'lucide-react'
import { SCHEDULE_NAMES } from '@/components/dashboard/constants'
import { weekdayLabel, dateLabel } from '@/components/dashboard/utils'
import type { TeeTime } from '@/components/dashboard/types'

interface CalendarDayCardProps {
  date: string
  scheduleIds: string[]
  scheduledCheck: boolean
  perCourse: Record<string, TeeTime | null>
}

const CalendarDayCard: React.FC<CalendarDayCardProps> = ({ date, scheduleIds, scheduledCheck, perCourse }) => (
  <div className="rounded-lg border border-gray-200 p-3">
    <p className="text-base font-semibold text-gray-900">{weekdayLabel(date)}</p>
    <div className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-500">
      <span>{dateLabel(date)}</span>
      {scheduledCheck && <Search className="h-3.5 w-3.5 text-gray-400" />}
    </div>

    <div className="mt-3 space-y-2">
      {scheduleIds.map(scheduleId => {
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

export default CalendarDayCard
