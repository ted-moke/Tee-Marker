import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, CheckCircle, AlertCircle, Play, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/api'

interface SchedulerStatus {
  isRunning: boolean
  lastCheck: string | null
  nextCheck: string | null
  lastCheckResult: {
    timesFound: number
    notified: number
    errors: string[]
  } | null
}

interface CheckRecord {
  id: string
  timestamp: string
  schedulesChecked: string[]
  timesFound: number
  notified: number
  errors: string[]
}

const SCHEDULE_NAMES: Record<string, string> = {
  '11078': 'Francis Byrne',
  '11075': 'Hendricks Field',
  '11077': 'Weequahic',
}

function fmt(ts: string | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleString()
}

const Dashboard: React.FC = () => {
  const queryClient = useQueryClient()

  const { data: statusRes } = useQuery({
    queryKey: ['status'],
    queryFn: () => api.get<{ success: boolean; data: SchedulerStatus }>('/status'),
    refetchInterval: 30_000,
  })

  const { data: historyRes } = useQuery({
    queryKey: ['history'],
    queryFn: () => api.get<{ success: boolean; data: CheckRecord[] }>('/history?limit=10'),
    refetchInterval: 60_000,
  })

  const runNow = useMutation({
    mutationFn: () => api.post('/scheduler/run'),
    onSuccess: () => {
      toast.success('Check completed')
      queryClient.invalidateQueries({ queryKey: ['status'] })
      queryClient.invalidateQueries({ queryKey: ['history'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const status = statusRes?.data
  const history = historyRes?.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Tee time monitoring status and recent activity</p>
      </div>

      {/* Status card */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Scheduler</h2>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            status?.isRunning ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {status?.isRunning ? 'Running' : 'Stopped'}
          </span>
        </div>

        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-gray-500">Last check</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">{fmt(status?.lastCheck ?? null)}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Next check</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">{fmt(status?.nextCheck ?? null)}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Last result</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {status?.lastCheckResult
                ? `${status.lastCheckResult.timesFound} found · ${status.lastCheckResult.notified} notified`
                : '—'}
            </dd>
          </div>
        </dl>

        <div className="mt-4">
          <button
            onClick={() => runNow.mutate()}
            disabled={runNow.isPending}
            className="btn btn-primary flex items-center"
          >
            {runNow.isPending
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking...</>
              : <><Play className="h-4 w-4 mr-2" /> Run Now</>
            }
          </button>
        </div>
      </div>

      {/* Recent activity */}
      <div className="card">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Checks</h2>
        {history.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">No checks run yet. Click Run Now to start.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map(record => (
              <div key={record.id} className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
                <div className="flex items-start space-x-3">
                  {record.errors.length > 0
                    ? <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                    : <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
                  }
                  <div>
                    <p className="text-sm font-medium text-gray-900">{fmt(record.timestamp)}</p>
                    <p className="text-sm text-gray-500">
                      {record.schedulesChecked.map(id => SCHEDULE_NAMES[id] ?? id).join(', ')}
                    </p>
                    {record.errors.length > 0 && (
                      <p className="text-xs text-red-500 mt-1">{record.errors[0]}</p>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-sm font-medium text-gray-900">{record.timesFound} found</p>
                  {record.notified > 0 && (
                    <p className="text-xs text-green-600">{record.notified} notified</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
