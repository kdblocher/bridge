import { readonlyArray } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface State {
  implicitPass: boolean
}

const initialState: State = {
  implicitPass: false
}

const name = 'settings'
const slice = createSlice({
  name,
  initialState,
  reducers: {
    setInitial: (state, action: PayloadAction<SettingsState>) => {
      pipe(Object.keys(state) as ReadonlyArray<keyof State>,
        readonlyArray.map(p => state[p] = action.payload[p]))
    },
    setProperty: {
      reducer: (state, action: PayloadAction<any, string, keyof State>) => {
        state[action.meta] = action.payload
      },
      prepare: <K extends keyof State, V extends State[K]>(key: K, value: V) =>
        ({ payload: value, meta: key })
    }
  }
})

export const { setProperty: setSettingsProperty, setInitial: setInitialSettings } = slice.actions
export type SettingsState = State
export default slice.reducer