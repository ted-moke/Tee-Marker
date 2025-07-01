import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface Automation {
  id: string
  userId: string
  name: string
  courses: string[]
  timeRange: {
    start: string
    end: string
  }
  daysOfWeek: number[]
  checkInterval: number
  isActive: boolean
  bookingAction: 'notify' | 'auto-book'
  createdAt: Date
  updatedAt: Date
}

interface AutomationsState {
  automations: Automation[]
  loading: boolean
  error: string | null
}

const initialState: AutomationsState = {
  automations: [],
  loading: false,
  error: null,
}

const automationsSlice = createSlice({
  name: 'automations',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    setAutomations: (state, action: PayloadAction<Automation[]>) => {
      state.automations = action.payload
    },
    addAutomation: (state, action: PayloadAction<Automation>) => {
      state.automations.push(action.payload)
    },
    updateAutomation: (state, action: PayloadAction<Automation>) => {
      const index = state.automations.findIndex(a => a.id === action.payload.id)
      if (index !== -1) {
        state.automations[index] = action.payload
      }
    },
    deleteAutomation: (state, action: PayloadAction<string>) => {
      state.automations = state.automations.filter(a => a.id !== action.payload)
    },
    toggleAutomation: (state, action: PayloadAction<string>) => {
      const automation = state.automations.find(a => a.id === action.payload)
      if (automation) {
        automation.isActive = !automation.isActive
      }
    },
  },
})

export const {
  setLoading,
  setError,
  setAutomations,
  addAutomation,
  updateAutomation,
  deleteAutomation,
  toggleAutomation,
} = automationsSlice.actions

export default automationsSlice.reducer 