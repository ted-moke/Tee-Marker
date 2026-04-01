import React, { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface DatePickerProps {
  selectedDates: string[]
  onChange: (dates: string[]) => void
}

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]!
}

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1)
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

const DatePicker: React.FC<DatePickerProps> = ({ selectedDates, onChange }) => {
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  const todayStr = toISO(now)
  const maxDate = new Date(now)
  maxDate.setMonth(maxDate.getMonth() + 3)
  const maxStr = toISO(maxDate)

  const selected = new Set(selectedDates)

  function toggleDate(dateStr: string) {
    if (dateStr < todayStr || dateStr > maxStr) return
    const next = new Set(selected)
    if (next.has(dateStr)) {
      next.delete(dateStr)
    } else {
      next.add(dateStr)
    }
    onChange(Array.from(next).sort())
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(y => y - 1)
    } else {
      setViewMonth(m => m - 1)
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(y => y + 1)
    } else {
      setViewMonth(m => m + 1)
    }
  }

  // Disable prev if we're already at the current month
  const isPrevDisabled = viewYear === now.getFullYear() && viewMonth === now.getMonth()
  // Disable next if we're 3 months ahead
  const maxMonth = new Date(now)
  maxMonth.setMonth(maxMonth.getMonth() + 3)
  const isNextDisabled =
    viewYear > maxMonth.getFullYear() ||
    (viewYear === maxMonth.getFullYear() && viewMonth >= maxMonth.getMonth())

  const firstDayOfMonth = startOfMonth(viewYear, viewMonth).getDay()
  const numDays = daysInMonth(viewYear, viewMonth)

  // Build grid cells (leading blanks + day numbers)
  const cells: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: numDays }, (_, i) => i + 1),
  ]

  return (
    <div className="w-full max-w-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          disabled={isPrevDisabled}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-gray-900">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          disabled={isNextDisabled}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_OF_WEEK.map(d => (
          <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`blank-${idx}`} />
          }
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isPast = dateStr < todayStr
          const isBeyondMax = dateStr > maxStr
          const isDisabled = isPast || isBeyondMax
          const isSelected = selected.has(dateStr)
          const isToday = dateStr === todayStr

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isDisabled}
              onClick={() => toggleDate(dateStr)}
              className={[
                'text-sm rounded-md py-1.5 w-full transition-colors font-medium',
                isDisabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : isSelected
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : isToday
                  ? 'ring-1 ring-primary-400 text-primary-700 hover:bg-primary-50'
                  : 'text-gray-700 hover:bg-gray-100',
              ].join(' ')}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default DatePicker
