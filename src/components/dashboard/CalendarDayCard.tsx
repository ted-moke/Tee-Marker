import React, { useState } from 'react'
import { Search, ChevronDown, ChevronUp } from 'lucide-react'
import { SCHEDULE_NAMES } from '@/components/dashboard/constants'
import { weekdayLabel, dateLabel, formatTime12h } from '@/components/dashboard/utils'
import WeatherMetrics from '@/components/weather/WeatherMetrics'
import { DEFAULT_WEATHER_THRESHOLDS } from '@/components/dashboard/types'
import type { CourseDaySummary, WeatherThresholds } from '@/components/dashboard/types'

interface CalendarDayCardProps {
  date: string
  scheduleIds: string[]
  scheduledCheck: boolean
  perCourse: Record<string, CourseDaySummary>
  thresholds?: WeatherThresholds
}

const CalendarDayCard: React.FC<CalendarDayCardProps> = ({
  date,
  scheduleIds,
  scheduledCheck,
  perCourse,
  thresholds = DEFAULT_WEATHER_THRESHOLDS,
}) => {
  const [expandedCourses, setExpandedCourses] = useState<Record<string, boolean>>({})
  const [showAllCourses, setShowAllCourses] = useState<Record<string, boolean>>({})
  const visibleScheduleIds = scheduleIds.filter(scheduleId => {
    const summary = perCourse[scheduleId]
    return Boolean(summary?.earliest)
  })

  function toggleExpanded(scheduleId: string): void {
    setExpandedCourses(prev => ({ ...prev, [scheduleId]: !prev[scheduleId] }))
    setShowAllCourses(prev => ({ ...prev, [scheduleId]: false }))
  }

  function toggleShowAll(scheduleId: string): void {
    setShowAllCourses(prev => ({ ...prev, [scheduleId]: !prev[scheduleId] }))
  }

  return (
    <div className="rounded-md border border-gray-200 p-2">
      <div className="flex items-center gap-1">
        <p className="text-sm font-semibold text-gray-900">{weekdayLabel(date)} {dateLabel(date)}</p>
        {scheduledCheck && <Search className="h-3.5 w-3.5 text-gray-400" />}
      </div>

      <div className="mt-2 space-y-1">
        {visibleScheduleIds.length === 0 && (
          <div className="rounded-sm bg-gray-50 px-2 py-1 text-xs text-gray-400">
            No times
          </div>
        )}

        {visibleScheduleIds.map(scheduleId => {
          const summary = perCourse[scheduleId] ?? { earliest: null, additionalCount: 0, allTimes: [] }
          const earliest = summary.earliest
          const courseName = SCHEDULE_NAMES[scheduleId] ?? scheduleId
          const isExpanded = Boolean(expandedCourses[scheduleId])
          const showAll = Boolean(showAllCourses[scheduleId])
          const nextTimes = summary.allTimes.slice(1)
          const visibleExtraTimes = showAll ? nextTimes : nextTimes.slice(0, 5)
          const hiddenCount = Math.max(0, nextTimes.length - visibleExtraTimes.length)
          if (!earliest) return null

          return (
            <div key={scheduleId} className="rounded-sm bg-gray-50 px-2 py-1 text-xs text-gray-700">
              <button
                type="button"
                onClick={() => toggleExpanded(scheduleId)}
                className="w-full text-left"
              >
                <span className="text-gray-600">{courseName}</span>{' '}
                <span className="font-semibold text-gray-900">{formatTime12h(earliest.time)}</span>{' '}
                <span className="text-gray-600">· {earliest.availableSpots} players</span>
                {summary.additionalCount > 0 && (
                  <span className="text-gray-500"> | {summary.additionalCount} more times</span>
                )}
                <span className="inline-flex align-middle ml-1 text-gray-400">
                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </span>
              </button>
              <div className="mt-0.5">
                <WeatherMetrics weather={earliest.weather} thresholds={thresholds} />
              </div>

              {isExpanded && nextTimes.length > 0 && (
                <div className="mt-1 space-y-0.5 border-t border-gray-200 pt-1">
                  {visibleExtraTimes.map(time => (
                    <div key={time.id} className="space-y-0.5">
                      <p className="text-xs text-gray-600">
                        {formatTime12h(time.time)} · {time.availableSpots} players
                      </p>
                      <div className="pl-1">
                        <WeatherMetrics weather={time.weather} thresholds={thresholds} />
                      </div>
                    </div>
                  ))}
                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleShowAll(scheduleId)}
                      className="text-xs font-medium text-primary-600 hover:text-primary-700"
                    >
                      See more
                    </button>
                  )}
                  {showAll && nextTimes.length > 5 && (
                    <button
                      type="button"
                      onClick={() => toggleShowAll(scheduleId)}
                      className="ml-3 text-xs font-medium text-gray-500 hover:text-gray-700"
                    >
                      Show less
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default CalendarDayCard
