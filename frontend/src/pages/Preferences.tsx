import React, { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Loader2, Save, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/api'
import DatePicker from '@/components/DatePicker'

interface Preferences {
  scheduleIds: string[]
  specificDates: string[]
  timeRange: { start: string; end: string }
  players: number
  checkIntervalMinutes: number
  forecastOffsetHours: number
  discordWebhookUrl: string
  reservationReminders: boolean
  weeklyDigest: boolean
  weatherThresholds: {
    rainGoodMax: number
    rainBadMin: number
    windGoodMax: number
    windMidMax: number
    tempBadLow: number
    tempGoodMin: number
    tempGoodMax: number
    tempBadHigh: number
  }
}

const SCHEDULE_GROUPS: { group: string; schedules: { id: string; name: string }[] }[] = [
  {
    group: 'Foreup – Essex County',
    schedules: [
      { id: '11078', name: 'Francis Byrne' },
      { id: '11075', name: 'Hendricks Field' },
      { id: '11077', name: 'Weequahic' },
    ],
  },
  {
    group: 'EzLinks – Union County',
    schedules: [
      { id: '4549', name: 'Galloping Hill GC' },
      { id: '4551', name: 'Galloping Hill GC (Learning Center 9)' },
      { id: '4545', name: 'Ash Brook GC' },
    ],
  },
]

const INTERVALS = [5, 10, 15, 20, 30, 60]

const DEFAULT: Preferences = {
  scheduleIds: ['11078'],
  specificDates: [],
  timeRange: { start: '07:00', end: '10:00' },
  players: 1,
  checkIntervalMinutes: 30,
  forecastOffsetHours: 0,
  discordWebhookUrl: '',
  reservationReminders: true,
  weeklyDigest: true,
  weatherThresholds: {
    rainGoodMax: 20,
    rainBadMin: 60,
    windGoodMax: 5,
    windMidMax: 12,
    tempBadLow: 45,
    tempGoodMin: 60,
    tempGoodMax: 80,
    tempBadHigh: 90,
  },
}

const Preferences: React.FC = () => {
  const queryClient = useQueryClient()

  const { data: prefsRes, isLoading } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => api.get<{ success: boolean; data: Preferences }>('/preferences'),
  })

  const { register, handleSubmit, watch, setValue, reset, formState: { isDirty } } = useForm<Preferences>({
    defaultValues: DEFAULT,
  })

  useEffect(() => {
    if (prefsRes?.data) {
      reset(prefsRes.data)
    }
  }, [prefsRes, reset])

  const saveMutation = useMutation({
    mutationFn: (data: Preferences) => api.put('/preferences', data),
    onSuccess: () => {
      toast.success('Preferences saved')
      queryClient.invalidateQueries({ queryKey: ['preferences'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const testMutation = useMutation({
    mutationFn: (url: string) => api.post('/preferences/test-webhook', { url }),
    onSuccess: () => toast.success('Test message sent to Discord'),
    onError: () => toast.error('Webhook test failed — check the URL'),
  })

  const watchedScheduleIds = watch('scheduleIds') ?? []
  const watchedDates = watch('specificDates') ?? []
  const watchedWebhook = watch('discordWebhookUrl')

  function toggleArrayValue<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
  }

  // Prune past dates when preferences load
  useEffect(() => {
    if (watchedDates.length > 0) {
      const today = new Date().toISOString().split('T')[0]!
      const future = watchedDates.filter(d => d >= today)
      if (future.length !== watchedDates.length) {
        setValue('specificDates', future, { shouldDirty: true })
      }
    }
  // Only run on initial load, not on every change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsRes])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Preferences</h1>
        <p className="mt-1 text-sm text-gray-500">Configure which tee times to monitor and how to notify you</p>
      </div>

      <form onSubmit={handleSubmit(data => saveMutation.mutate(data))} className="space-y-6">

        {/* Schedules */}
        <div className="card">
          <h2 className="text-base font-medium text-gray-900 mb-3">Courses to Monitor</h2>
          <div className="space-y-4">
            {SCHEDULE_GROUPS.map(({ group, schedules }) => (
              <div key={group}>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{group}</div>
                <div className="space-y-2">
                  {schedules.map(s => (
                    <label key={s.id} className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary-600"
                        checked={watchedScheduleIds.includes(s.id)}
                        onChange={() => setValue('scheduleIds', toggleArrayValue(watchedScheduleIds, s.id), { shouldDirty: true })}
                      />
                      <span className="text-sm text-gray-700">{s.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dates to monitor */}
        <div className="card">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-base font-medium text-gray-900">Dates to Monitor</h2>
            {watchedDates.length > 0 && (
              <span className="text-sm text-gray-500">{watchedDates.length} selected</span>
            )}
          </div>
          <DatePicker
            selectedDates={watchedDates}
            onChange={dates => setValue('specificDates', dates, { shouldDirty: true })}
          />
        </div>

        {/* Time range + players */}
        <div className="card">
          <h2 className="text-base font-medium text-gray-900 mb-3">Time Window</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Earliest tee time</label>
              <input type="time" {...register('timeRange.start')} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Latest tee time</label>
              <input type="time" {...register('timeRange.end')} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Min players available</label>
              <input type="number" min={1} max={4} {...register('players', { valueAsNumber: true })} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Forecast offset (hours)</label>
              <input
                type="number"
                min={0}
                max={6}
                step={1}
                {...register('forecastOffsetHours', { valueAsNumber: true })}
                className="input w-full"
              />
              <p className="mt-1 text-xs text-gray-500">0 = tee time weather, 2 = around halfway through round</p>
            </div>
          </div>
        </div>

        {/* Scheduling */}
        <div className="card">
          <h2 className="text-base font-medium text-gray-900 mb-3">Check Schedule</h2>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Check every</label>
            <select {...register('checkIntervalMinutes', { valueAsNumber: true })} className="input w-full max-w-xs">
              {INTERVALS.map(n => (
                <option key={n} value={n}>{n} minutes</option>
              ))}
            </select>
          </div>
        </div>

        {/* Weather thresholds */}
        <div className="card">
          <h2 className="text-base font-medium text-gray-900 mb-3">Weather Highlight Thresholds (Imperial)</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Rain green if below (%)</label>
              <input type="number" {...register('weatherThresholds.rainGoodMax', { valueAsNumber: true })} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Rain red if above (%)</label>
              <input type="number" {...register('weatherThresholds.rainBadMin', { valueAsNumber: true })} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Wind green if below (mph)</label>
              <input type="number" {...register('weatherThresholds.windGoodMax', { valueAsNumber: true })} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Wind yellow up to (mph)</label>
              <input type="number" {...register('weatherThresholds.windMidMax', { valueAsNumber: true })} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Temp red if below (F)</label>
              <input type="number" {...register('weatherThresholds.tempBadLow', { valueAsNumber: true })} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Temp green from (F)</label>
              <input type="number" {...register('weatherThresholds.tempGoodMin', { valueAsNumber: true })} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Temp green to (F)</label>
              <input type="number" {...register('weatherThresholds.tempGoodMax', { valueAsNumber: true })} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Temp red if above (F)</label>
              <input type="number" {...register('weatherThresholds.tempBadHigh', { valueAsNumber: true })} className="input w-full" />
            </div>
          </div>
        </div>

        {/* Reservation reminders */}
        <div className="card">
          <h2 className="text-base font-medium text-gray-900 mb-3">Reservation Reminders</h2>
          <p className="text-xs text-gray-500 mb-3">Sent to your Discord webhook.</p>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary-600" {...register('reservationReminders')} />
              <div>
                <span className="text-sm text-gray-700 font-medium">Day-of reminder</span>
                <p className="text-xs text-gray-400">Discord message at 6am on days you have a tee time booked</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary-600" {...register('weeklyDigest')} />
              <div>
                <span className="text-sm text-gray-700 font-medium">Weekly digest</span>
                <p className="text-xs text-gray-400">Summary of upcoming bookings + unbooked weeks, sent Mon/Thu/Sun at 8am</p>
              </div>
            </label>
          </div>
        </div>

        {/* Discord webhook */}
        <div className="card">
          <h2 className="text-base font-medium text-gray-900 mb-3">Discord Notifications</h2>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://discord.com/api/webhooks/..."
              {...register('discordWebhookUrl')}
              className="input flex-1"
            />
            <button
              type="button"
              onClick={() => testMutation.mutate(watchedWebhook)}
              disabled={!watchedWebhook || testMutation.isPending}
              className="btn btn-secondary flex items-center"
            >
              {testMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><Send className="h-4 w-4 mr-1.5" />Test</>
              }
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Create a webhook in your Discord server settings and paste the URL here.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!isDirty || saveMutation.isPending}
            className="btn btn-primary flex items-center"
          >
            {saveMutation.isPending
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
              : <><Save className="h-4 w-4 mr-2" />Save Preferences</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}

export default Preferences
