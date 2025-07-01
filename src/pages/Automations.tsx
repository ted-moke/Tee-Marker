import React from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { Plus, Clock, Settings, Trash2 } from 'lucide-react'

const Automations: React.FC = () => {
  const { automations } = useSelector((state: RootState) => state.automations)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automations</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your tee time tracking automations
          </p>
        </div>
        <button className="btn btn-primary flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          New Automation
        </button>
      </div>

      {automations.length === 0 ? (
        <div className="card text-center py-12">
          <Clock className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No automations yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Create your first automation to start tracking tee times automatically.
          </p>
          <div className="mt-6">
            <button className="btn btn-primary">
              <Plus className="h-4 w-4 mr-2" />
              Create Automation
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6">
          {automations.map((automation) => (
            <div key={automation.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center">
                    <h3 className="text-lg font-medium text-gray-900">{automation.name}</h3>
                    <span
                      className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        automation.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {automation.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Checking {automation.courses.length} course(s) every {automation.checkInterval} minutes
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Time range: {automation.timeRange.start} - {automation.timeRange.end}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="p-2 text-gray-400 hover:text-gray-600">
                    <Settings className="h-4 w-4" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Automations 