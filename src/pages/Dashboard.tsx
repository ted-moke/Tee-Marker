import React from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { Clock, MapPin, CheckCircle, AlertCircle } from 'lucide-react'

const Dashboard: React.FC = () => {
  const { automations } = useSelector((state: RootState) => state.automations)
  const { courses } = useSelector((state: RootState) => state.courses)

  const activeAutomations = automations.filter(a => a.isActive)
  const totalAutomations = automations.length

  const stats = [
    {
      name: 'Active Automations',
      value: activeAutomations.length,
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      name: 'Total Automations',
      value: totalAutomations,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      name: 'Configured Courses',
      value: courses.length,
      icon: MapPin,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      name: 'Recent Checks',
      value: '24',
      icon: AlertCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of your golf tee time tracking automations
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.name} className="card">
              <div className="flex items-center">
                <div className={`flex-shrink-0 ${stat.bgColor} rounded-md p-3`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stat.value}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {activeAutomations.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No automations yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating your first automation to track tee times.
              </p>
            </div>
          ) : (
            activeAutomations.slice(0, 5).map((automation) => (
              <div key={automation.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{automation.name}</p>
                  <p className="text-sm text-gray-500">
                    Checking {automation.courses.length} course(s) every {automation.checkInterval} minutes
                  </p>
                </div>
                <div className="flex items-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Active
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard 