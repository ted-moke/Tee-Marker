export const FRANCIS_BYRNE_SCHEDULES: Record<string, string> = {
  '11078': 'Francis Byrne',
  '11075': 'Hendricks Field',
  '11077': 'Weequahic',
}

export const FOREUP_COURSE_BY_SCHEDULE: Record<string, string> = {
  '11078': '22528', // Francis Byrne
  '11077': '22527', // Weequahic
  '11075': '22526', // Hendricks Field
}

export const VALID_CHECK_INTERVALS = [5, 10, 15, 20, 30, 60]

export const DEFAULT_PREFERENCES = {
  scheduleIds: ['11078'],
  daysOfWeek: [0, 6],
  timeRange: { start: '07:00', end: '10:00' },
  players: 1,
  checkIntervalMinutes: 30,
  lookAheadDays: 7,
  discordWebhookUrl: '',
}
