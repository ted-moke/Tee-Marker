import React from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { Plus, MapPin, Settings, Trash2 } from 'lucide-react'

const Courses: React.FC = () => {
  const { courses } = useSelector((state: RootState) => state.courses)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Courses</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage golf course configurations and API settings
          </p>
        </div>
        <button className="btn btn-primary flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          Add Course
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="card text-center py-12">
          <MapPin className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No courses configured</h3>
          <p className="mt-1 text-sm text-gray-500">
            Add your first golf course to start tracking tee times.
          </p>
          <div className="mt-6">
            <button className="btn btn-primary">
              <Plus className="h-4 w-4 mr-2" />
              Add Course
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6">
          {courses.map((course) => (
            <div key={course.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center">
                    <h3 className="text-lg font-medium text-gray-900">{course.name}</h3>
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {course.platform}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Booking window: {course.bookingWindow.advanceDays} days in advance
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Timezone: {course.timezone}
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

export default Courses 