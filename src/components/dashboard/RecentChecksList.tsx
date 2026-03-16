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
      <div className="text-center py-4">
        <Clock className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-1 text-xs text-gray-500">No checks run yet. Click run to start.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {history.slice(0, 10).map(record => (
        <div key={record.id} className="flex items-start justify-between py-2 border-b border-gray-100 last:border-0">
          <div className="flex items-start space-x-2">
            {record.errors.length > 0
              ? <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              : <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
            }
            <div>
              <p className="text-xs font-medium text-gray-900">{fmt(record.timestamp)}</p>
              <p className="text-xs text-gray-500">
                {record.schedulesChecked.map(id => SCHEDULE_NAMES[id] ?? id).join(', ')}
              </p>
              {record.errors.length > 0 && (
                <p className="text-xs text-red-500 mt-1">{record.errors[0]}</p>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-2">
            <p className="text-xs font-medium text-gray-900">{record.timesFound} found</p>
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
