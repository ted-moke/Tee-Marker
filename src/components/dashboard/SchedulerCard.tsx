import React from 'react'
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import type { SchedulerStatus, CheckRecord } from '@/components/dashboard/types'
import RecentChecksList from '@/components/dashboard/RecentChecksList'

interface SchedulerCardProps {
  status?: SchedulerStatus
  runNowPending: boolean
  onRunNow: () => void
  runWeatherOutlookPending: boolean
  onRunWeatherOutlook: () => void
  checksLast24h: number
  showRecentChecks: boolean
  onToggleRecentChecks: () => void
  history: CheckRecord[]
}

const SchedulerCard: React.FC<SchedulerCardProps> = ({
  status,
  runNowPending,
  onRunNow,
  runWeatherOutlookPending,
  onRunWeatherOutlook,
  checksLast24h,
  showRecentChecks,
  onToggleRecentChecks,
  history,
}) => (
  <div className="card p-3 sm:p-4">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-medium text-gray-900">Scheduler</h2>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          status?.isRunning ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
        }`}>
          {status?.isRunning ? 'Running' : 'Stopped'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onRunWeatherOutlook}
          disabled={runWeatherOutlookPending}
          className="btn btn-secondary text-sm px-3 py-1.5"
        >
          {runWeatherOutlookPending
            ? <span className="inline-flex items-center"><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</span>
            : 'send 14-day weather'}
        </button>

        <button
          onClick={onRunNow}
          disabled={runNowPending}
          className="btn btn-primary text-sm px-3 py-1.5"
        >
          {runNowPending
            ? <span className="inline-flex items-center"><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running...</span>
            : 'run'}
        </button>
      </div>
    </div>

    <div className="border-t border-gray-100 pt-2">
      <button
        type="button"
        onClick={onToggleRecentChecks}
        className="w-full flex items-center justify-between rounded-md px-1.5 py-1.5 text-left hover:bg-gray-50"
      >
        <span className="text-sm font-medium text-gray-900">{checksLast24h} checks in the last 24h</span>
        {showRecentChecks
          ? <ChevronUp className="h-4 w-4 text-gray-500" />
          : <ChevronDown className="h-4 w-4 text-gray-500" />
        }
      </button>

      {showRecentChecks && (
        <div className="mt-1">
          <RecentChecksList history={history} />
        </div>
      )}
    </div>
  </div>
)

export default SchedulerCard
