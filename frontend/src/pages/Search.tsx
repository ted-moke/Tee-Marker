import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search as SearchIcon, Loader2 } from 'lucide-react'
import { api } from '@/api'
import WeatherMetrics from '@/components/weather/WeatherMetrics'
import { DEFAULT_WEATHER_THRESHOLDS } from '@/components/dashboard/types'
import type { TeeTime, Preferences } from '@/components/dashboard/types'

const SCHEDULES = [
  { id: '11078', name: 'Francis Byrne' },
  { id: '11075', name: 'Hendricks Field' },
  { id: '11077', name: 'Weequahic' },
]

function todayStr(): string {
  return new Date().toISOString().split('T')[0]!
}

const Search: React.FC = () => {
  const [scheduleId, setScheduleId] = useState('11078')
  const [date, setDate] = useState(todayStr())
  const [players, setPlayers] = useState(1)
  const [submitted, setSubmitted] = useState(false)

  const { data: res, isFetching, refetch } = useQuery({
    queryKey: ['search', scheduleId, date, players],
    queryFn: () => api.get<{ success: boolean; data: TeeTime[] }>(
      `/tee-times/search?scheduleId=${scheduleId}&date=${date}&players=${players}`
    ),
    enabled: false,
  })

  const { data: prefsRes } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => api.get<{ success: boolean; data: Preferences }>('/preferences'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    refetch()
  }

  const times = res?.data ?? []
  const thresholds = prefsRes?.data.weatherThresholds ?? DEFAULT_WEATHER_THRESHOLDS

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Search Tee Times</h1>
        <p className="mt-1 text-sm text-gray-500">Manually search for available tee times on a specific date</p>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Course</label>
            <select
              value={scheduleId}
              onChange={e => setScheduleId(e.target.value)}
              className="input"
            >
              {SCHEDULES.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Date</label>
            <input
              type="date"
              value={date}
              min={todayStr()}
              onChange={e => setDate(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Players</label>
            <input
              type="number"
              min={1}
              max={4}
              value={players}
              onChange={e => setPlayers(parseInt(e.target.value))}
              className="input w-20"
            />
          </div>
          <button type="submit" disabled={isFetching} className="btn btn-primary flex items-center">
            {isFetching
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Searching...</>
              : <><SearchIcon className="h-4 w-4 mr-2" />Search</>
            }
          </button>
        </form>
      </div>

      {submitted && (
        <div className="card">
          {isFetching ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : times.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No tee times found for the selected criteria.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Available Spots</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weather</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {times.map(t => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{t.time}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{t.availableSpots}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {t.price !== undefined ? `$${t.price.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <WeatherMetrics weather={t.weather} thresholds={thresholds} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

export default Search
