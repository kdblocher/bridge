import { readonlyArray } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface State {
  implicitPass: boolean
  generateCount: number
}

const initialState: State = {
  implicitPass: false,
  generateCount: 30000
}

const name = 'settings'
const slice = createSlice({
  name,
  initialState,
  reducers: {
    setInitial: (state, action: PayloadAction<SettingsState>) => {
      pipe(Object.keys(action.payload) as ReadonlyArray<keyof State>,
        readonlyArray.map(p => (state as any)[p] = action.payload[p] as any))
    },
    setProperty: {
      reducer: (state, action: PayloadAction<any, string, keyof State>) => {
        (state as any)[action.meta] = action.payload
      },
      prepare: <K extends keyof State, V extends State[K]>(key: K, value: V) =>
        ({ payload: value, meta: key })
    }
  }
})

export const { setProperty: setSettingsProperty, setInitial: setInitialSettings } = slice.actions
export type SettingsState = State
export default slice.reducer