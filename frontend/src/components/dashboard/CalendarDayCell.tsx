import React from 'react'
import { EyeOff, Bookmark } from 'lucide-react'
import CourseChip from '@/components/dashboard/CourseChip'
import type { CourseDaySummary, Reservation } from '@/components/dashboard/types'

interface CalendarDayCellProps {
  date: string
  scheduleIds: string[]
  perCourse: Record<string, CourseDaySummary>
  isMonitored: boolean
  isToday: boolean
  reservation?: Reservation
  selectedScheduleId: string | null
  onChipClick: (scheduleId: string) => void
}

function dayNumber(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00`).getDate()
}

const CalendarDayCell: React.FC<CalendarDayCellProps> = ({
  date,
  scheduleIds,
  perCourse,
  isMonitored,
  isToday,
  reservation,
  selectedScheduleId,
  onChipClick,
}) => {
  const visibleScheduleIds = scheduleIds.filter(id => Boolean(perCourse[id]?.earliest))

  const borderClasses = reservation
    ? 'border border-gray-200 border-l-4 border-l-primary-500'
    : 'border border-gray-200'
  const bgClasses = isToday ? 'bg-primary-50' : 'bg-white'
  const opacityClass = isMonitored ? '' : 'opacity-60'

  return (
    <div
      className={`relative flex flex-col rounded-md ${borderClasses} ${bgClasses} ${opacityClass} p-1 sm:p-1.5 min-h-[80px] sm:min-h-[110px]`}
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className={`text-xs sm:text-sm font-semibold ${isToday ? 'text-primary-700' : 'text-gray-900'}`}
        >
          {dayNumber(date)}
        </span>
        <div className="flex items-center gap-0.5 text-gray-400">
          {reservation && (
            <Bookmark
              className="h-3 w-3 fill-primary-500 text-primary-500"
              aria-label="Reservation booked"
            />
          )}
          {!isMonitored && (
            <EyeOff className="h-3 w-3" aria-label="Not actively monitored" />
          )}
        </div>
      </div>

      <div className="mt-1 flex flex-col gap-0.5">
        {visibleScheduleIds.map(scheduleId => {
          const summary = perCourse[scheduleId]!
          return (
            <CourseChip
              key={scheduleId}
              scheduleId={scheduleId}
              summary={summary}
              isSelected={selectedScheduleId === scheduleId}
              onClick={() => onChipClick(scheduleId)}
            />
          )
        })}
      </div>
    </div>
  )
}

export default CalendarDayCell
