import { COURSE_LOCATION_BY_SCHEDULE, CourseLocation } from '../constants'
import { TeeTime } from '../types'

const FRANCIS_BYRNE_SCHEDULE_ID = '11078'

export function resolveWeatherScheduleIdFromTimes(
  times: Pick<TeeTime, 'scheduleId'>[],
  fallbackScheduleId: string
): string {
  const hasFrancisByrne = times.some(time => time.scheduleId === FRANCIS_BYRNE_SCHEDULE_ID)
  if (hasFrancisByrne && COURSE_LOCATION_BY_SCHEDULE[FRANCIS_BYRNE_SCHEDULE_ID]) {
    return FRANCIS_BYRNE_SCHEDULE_ID
  }

  for (const time of times) {
    if (COURSE_LOCATION_BY_SCHEDULE[time.scheduleId]) {
      return time.scheduleId
    }
  }

  if (COURSE_LOCATION_BY_SCHEDULE[fallbackScheduleId]) {
    return fallbackScheduleId
  }

  return Object.keys(COURSE_LOCATION_BY_SCHEDULE)[0] ?? fallbackScheduleId
}

export function resolveWeatherLocationFromTimes(
  times: Pick<TeeTime, 'scheduleId'>[],
  fallbackScheduleId: string
): CourseLocation | null {
  const scheduleId = resolveWeatherScheduleIdFromTimes(times, fallbackScheduleId)
  return COURSE_LOCATION_BY_SCHEDULE[scheduleId] ?? null
}
