import { configureStore } from '@reduxjs/toolkit'
import automationsReducer from './slices/automationsSlice'
import coursesReducer from './slices/coursesSlice'
import userReducer from './slices/userSlice'

export const store = configureStore({
  reducer: {
    automations: automationsReducer,
    courses: coursesReducer,
    user: userReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch 