import React from 'react'
import { getCourseColor, getCourseShortName } from '@/components/dashboard/constants'
import { formatTime12hShort } from '@/components/dashboard/utils'
import type { CourseDaySummary } from '@/components/dashboard/types'

interface CourseChipProps {
  scheduleId: string
  summary: CourseDaySummary
  isSelected: boolean
  hasTimeInWindow: boolean
  onClick: () => void
}

const CourseChip: React.FC<CourseChipProps> = ({
  scheduleId,
  summary,
  isSelected,
  hasTimeInWindow,
  onClick,
}) => {
  const earliest = summary.earliest
  if (!earliest) return null

  const color = getCourseColor(scheduleId)
  const shortName = getCourseShortName(scheduleId)
  const time = formatTime12hShort(earliest.time)
  const extra = summary.additionalCount > 0 ? ` +${summary.additionalCount}` : ''
  const chipClasses = hasTimeInWindow ? color.chip : color.chipMuted

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${chipClasses} ${isSelected ? 'ring-2 ring-offset-1 ring-gray-700' : ''} block w-full rounded-sm border px-1.5 py-0.5 text-[10px] sm:text-xs font-medium leading-tight text-left truncate transition-colors`}
    >
      <span className="font-semibold">{shortName}</span>{' '}
      <span className="tabular-nums">{time}</span>
      <span className="text-[9px] sm:text-[10px] opacity-70">{extra}</span>
    </button>
  )
}

export default CourseChip
