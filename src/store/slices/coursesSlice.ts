import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface Course {
  id: string
  name: string
  platform: string
  apiConfig: {
    baseUrl: string
    endpoints: {
      search: string
      book: string
    }
    auth: {
      type: 'token' | 'oauth' | 'api-key'
      tokenRefreshUrl?: string
    }
  }
  bookingWindow: {
    advanceDays: number
    startTime: string
  }
  timezone: string
}

interface CoursesState {
  courses: Course[]
  loading: boolean
  error: string | null
}

const initialState: CoursesState = {
  courses: [],
  loading: false,
  error: null,
}

const coursesSlice = createSlice({
  name: 'courses',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    setCourses: (state, action: PayloadAction<Course[]>) => {
      state.courses = action.payload
    },
    addCourse: (state, action: PayloadAction<Course>) => {
      state.courses.push(action.payload)
    },
    updateCourse: (state, action: PayloadAction<Course>) => {
      const index = state.courses.findIndex(c => c.id === action.payload.id)
      if (index !== -1) {
        state.courses[index] = action.payload
      }
    },
    deleteCourse: (state, action: PayloadAction<string>) => {
      state.courses = state.courses.filter(c => c.id !== action.payload)
    },
  },
})

export const {
  setLoading,
  setError,
  setCourses,
  addCourse,
  updateCourse,
  deleteCourse,
} = coursesSlice.actions

export default coursesSlice.reducer 