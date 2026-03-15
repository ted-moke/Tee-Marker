import React from 'react'
import { Play, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { fmt } from '@/components/dashboard/utils'
import type { SchedulerStatus, CheckRecord } from '@/components/dashboard/types'
import RecentChecksList from '@/components/dashboard/RecentChecksList'

interface SchedulerCardProps {
  status?: SchedulerStatus
  runNowPending: boolean
  onRunNow: () => void
  checksLast24h: number
  showRecentChecks: boolean
  onToggleRecentChecks: () => void
  history: CheckRecord[]
}

const SchedulerCard: React.FC<SchedulerCardProps> = ({
  status,
  runNowPending,
  onRunNow,
  checksLast24h,
  showRecentChecks,
  onToggleRecentChecks,
  history,
}) => (
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
        onClick={onRunNow}
        disabled={runNowPending}
        className="btn btn-primary flex items-center"
      >
        {runNowPending
          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking...</>
          : <><Play className="h-4 w-4 mr-2" /> Run Now</>
        }
      </button>
    </div>

    <div className="mt-5 border-t border-gray-100 pt-4">
      <button
        type="button"
        onClick={onToggleRecentChecks}
        className="w-full flex items-center justify-between rounded-md px-2 py-2 text-left hover:bg-gray-50"
      >
        <span className="text-sm font-medium text-gray-900">{checksLast24h} checks in the last 24h</span>
        {showRecentChecks
          ? <ChevronUp className="h-4 w-4 text-gray-500" />
          : <ChevronDown className="h-4 w-4 text-gray-500" />
        }
      </button>

      {showRecentChecks && (
        <div className="mt-2">
          <RecentChecksList history={history} />
        </div>
      )}
    </div>
  </div>
)

export default SchedulerCard
