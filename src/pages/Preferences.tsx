import React, { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Loader2, Save, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/api'

interface Preferences {
  scheduleIds: string[]
  daysOfWeek: number[]
  timeRange: { start: string; end: string }
  players: number
  checkIntervalMinutes: number
  lookAheadDays: number
  discordWebhookUrl: string
}

const SCHEDULES = [
  { id: '11078', name: 'Francis Byrne' },
  { id: '11075', name: 'Hendricks Field' },
  { id: '11077', name: 'Weequahic' },
]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const INTERVALS = [5, 10, 15, 20, 30, 60]

const DEFAULT: Preferences = {
  scheduleIds: ['11078'],
  daysOfWeek: [0, 6],
  timeRange: { start: '07:00', end: '10:00' },
  players: 1,
  checkIntervalMinutes: 30,
  lookAheadDays: 7,
  discordWebhookUrl: '',
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
  const watchedDays = watch('daysOfWeek') ?? []
  const watchedWebhook = watch('discordWebhookUrl')

  function toggleArrayValue<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
  }

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
          <div className="space-y-2">
            {SCHEDULES.map(s => (
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

        {/* Days of week */}
        <div className="card">
          <h2 className="text-base font-medium text-gray-900 mb-3">Days of Week</h2>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setValue('daysOfWeek', toggleArrayValue(watchedDays, i), { shouldDirty: true })}
                className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                  watchedDays.includes(i)
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        {/* Time range + players */}
        <div className="card">
          <h2 className="text-base font-medium text-gray-900 mb-3">Time Window</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          </div>
        </div>

        {/* Scheduling */}
        <div className="card">
          <h2 className="text-base font-medium text-gray-900 mb-3">Check Schedule</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Check every</label>
              <select {...register('checkIntervalMinutes', { valueAsNumber: true })} className="input w-full">
                {INTERVALS.map(n => (
                  <option key={n} value={n}>{n} minutes</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Look ahead (days)</label>
              <input type="number" min={1} max={14} {...register('lookAheadDays', { valueAsNumber: true })} className="input w-full" />
            </div>
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
