import React from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { User, Bell, Globe, Shield } from 'lucide-react'

const Settings: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.user)

  const settingsSections = [
    {
      title: 'Account',
      icon: User,
      items: [
        { name: 'Profile', description: 'Manage your account information' },
        { name: 'Password', description: 'Change your password' },
        { name: 'Email', description: 'Update your email address' },
      ],
    },
    {
      title: 'Notifications',
      icon: Bell,
      items: [
        { name: 'Email Notifications', description: 'Configure email alerts' },
        { name: 'Push Notifications', description: 'Manage push notifications' },
        { name: 'Booking Alerts', description: 'Set up booking notifications' },
      ],
    },
    {
      title: 'Preferences',
      icon: Globe,
      items: [
        { name: 'Timezone', description: 'Set your local timezone' },
        { name: 'Language', description: 'Choose your preferred language' },
        { name: 'Date Format', description: 'Customize date display format' },
      ],
    },
    {
      title: 'Security',
      icon: Shield,
      items: [
        { name: 'Two-Factor Authentication', description: 'Add extra security to your account' },
        { name: 'API Keys', description: 'Manage your API credentials' },
        { name: 'Login History', description: 'View recent login activity' },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account preferences and settings
        </p>
      </div>

      <div className="grid gap-6">
        {settingsSections.map((section) => {
          const Icon = section.icon
          return (
            <div key={section.title} className="card">
              <div className="flex items-center mb-4">
                <Icon className="h-5 w-5 text-gray-400 mr-3" />
                <h2 className="text-lg font-medium text-gray-900">{section.title}</h2>
              </div>
              <div className="space-y-3">
                {section.items.map((item) => (
                  <div key={item.name} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-500">{item.description}</p>
                    </div>
                    <button className="text-sm text-primary-600 hover:text-primary-500">
                      Configure
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Settings 