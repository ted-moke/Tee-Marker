import React from 'react'
import { Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { SCHEDULE_NAMES } from '@/components/dashboard/constants'
import { fmt } from '@/components/dashboard/utils'
import type { CheckRecord } from '@/components/dashboard/types'

interface RecentChecksListProps {
  history: CheckRecord[]
}

const RecentChecksList: React.FC<RecentChecksListProps> = ({ history }) => {
  if (history.length === 0) {
    return (
      <div className="text-center py-6">
        <Clock className="mx-auto h-10 w-10 text-gray-400" />
        <p className="mt-2 text-sm text-gray-500">No checks run yet. Click Run Now to start.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {history.slice(0, 10).map(record => (
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
  )
}

export default RecentChecksList
