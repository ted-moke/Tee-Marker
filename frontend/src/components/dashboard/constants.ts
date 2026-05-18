export const SCHEDULE_NAMES: Record<string, string> = {
  '11078': 'Francis Byrne',
  '11075': 'Hendricks Field',
  '11077': 'Weequahic',
  '4549': 'Galloping Hill',
  '4551': 'Galloping Hill (Learning Center 9)',
  '4545': 'Ash Brook',
}

export const COURSE_SHORT_NAMES: Record<string, string> = {
  '11078': 'Byrne',
  '11075': 'Hend',
  '11077': 'Weeq',
  '4549': 'Gall',
  '4551': 'GH9',
  '4545': 'Ash',
}

export interface CourseColorTokens {
  chip: string
  chipMuted: string
  dot: string
  border: string
}

export const COURSE_COLORS: Record<string, CourseColorTokens> = {
  '11078': {
    chip: 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200',
    chipMuted: 'bg-transparent text-green-700 border-green-300 border-dashed hover:bg-green-50',
    dot: 'bg-green-500',
    border: 'border-green-400',
  },
  '11077': {
    chip: 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200',
    chipMuted: 'bg-transparent text-yellow-700 border-yellow-300 border-dashed hover:bg-yellow-50',
    dot: 'bg-yellow-500',
    border: 'border-yellow-400',
  },
  '4549': {
    chip: 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200',
    chipMuted: 'bg-transparent text-blue-700 border-blue-300 border-dashed hover:bg-blue-50',
    dot: 'bg-blue-500',
    border: 'border-blue-400',
  },
  '4545': {
    chip: 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200',
    chipMuted: 'bg-transparent text-red-700 border-red-300 border-dashed hover:bg-red-50',
    dot: 'bg-red-500',
    border: 'border-red-400',
  },
  '4551': {
    chip: 'bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200',
    chipMuted: 'bg-transparent text-orange-700 border-orange-300 border-dashed hover:bg-orange-50',
    dot: 'bg-orange-500',
    border: 'border-orange-400',
  },
  '11075': {
    chip: 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200',
    chipMuted: 'bg-transparent text-purple-700 border-purple-300 border-dashed hover:bg-purple-50',
    dot: 'bg-purple-500',
    border: 'border-purple-400',
  },
}

const FALLBACK_COLOR: CourseColorTokens = {
  chip: 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200',
  chipMuted: 'bg-transparent text-gray-700 border-gray-300 border-dashed hover:bg-gray-50',
  dot: 'bg-gray-500',
  border: 'border-gray-400',
}

export function getCourseColor(scheduleId: string): CourseColorTokens {
  return COURSE_COLORS[scheduleId] ?? FALLBACK_COLOR
}

export function getCourseShortName(scheduleId: string): string {
  return COURSE_SHORT_NAMES[scheduleId] ?? SCHEDULE_NAMES[scheduleId] ?? scheduleId
}
