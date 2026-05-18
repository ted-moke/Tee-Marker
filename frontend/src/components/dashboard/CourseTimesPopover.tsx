import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import WeatherMetrics from '@/components/weather/WeatherMetrics'
import { SCHEDULE_NAMES, getCourseColor } from '@/components/dashboard/constants'
import { formatTime12h, weekdayLabel, dateLabel } from '@/components/dashboard/utils'
import { DEFAULT_WEATHER_THRESHOLDS } from '@/components/dashboard/types'
import type { CourseDaySummary, WeatherThresholds } from '@/components/dashboard/types'

interface CourseTimesPopoverProps {
  date: string
  scheduleId: string
  summary: CourseDaySummary
  thresholds?: WeatherThresholds
  onClose: () => void
}

const CourseTimesPopover: React.FC<CourseTimesPopoverProps> = ({
  date,
  scheduleId,
  summary,
  thresholds = DEFAULT_WEATHER_THRESHOLDS,
  onClose,
}) => {
  const ref = useRef<HTMLDivElement>(null)
  const courseName = SCHEDULE_NAMES[scheduleId] ?? scheduleId
  const color = getCourseColor(scheduleId)

  useEffect(() => {
    function onMouseDown(e: MouseEvent): void {
      if (!ref.current) return
      if (e.target instanceof Node && ref.current.contains(e.target)) return
      onClose()
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 sm:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={ref}
        className="fixed inset-x-2 bottom-2 z-50 max-h-[80vh] overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 shadow-lg sm:absolute sm:inset-auto sm:left-1/2 sm:top-full sm:mt-1 sm:max-h-[60vh] sm:w-72 sm:-translate-x-1/2"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-full ${color.dot}`} />
              <p className="text-sm font-semibold text-gray-900">{courseName}</p>
            </div>
            <p className="text-xs text-gray-500">
              {weekdayLabel(date)} · {dateLabel(date)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-2 space-y-1.5">
          {summary.allTimes.length === 0 && (
            <p className="text-xs text-gray-500">No available times.</p>
          )}
          {summary.allTimes.map(t => (
            <div key={t.id} className="rounded bg-gray-50 px-2 py-1">
              <p className="text-xs text-gray-700">
                <span className="font-semibold text-gray-900">{formatTime12h(t.time)}</span>
                <span className="text-gray-600"> · {t.availableSpots} players</span>
              </p>
              <div className="mt-0.5">
                <WeatherMetrics weather={t.weather} thresholds={thresholds} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default CourseTimesPopover
