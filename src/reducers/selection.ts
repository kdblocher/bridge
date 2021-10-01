import * as D from 'io-ts/Decoder'

import { Constraint, satisfies } from '../model/constraints'
import { PayloadAction, createSlice } from "@reduxjs/toolkit"
import { constVoid, pipe } from "fp-ts/lib/function"
import { either, option } from "fp-ts"

import { castDraft } from "immer"
import { decodeHand } from '../parse'

const name = 'selection'
interface State {
  selectedBlockKey: option.Option<string>
  testHand: ReturnType<typeof decodeHand>
}
const initialState : State = {
  selectedBlockKey: option.none,
  testHand: either.left(D.error(constVoid(), "No hand supplied yet"))
}
const slice = createSlice({
  name,
  initialState,
  reducers: {
    setSelectedBlockKey: (state, action: PayloadAction<option.Option<string>>) => {
      state.selectedBlockKey = action.payload
    },
    setTestHand: (state, action: PayloadAction<string>) => {
      state.testHand = pipe(action.payload, decodeHand, castDraft)
    }
  }
})

export const { setSelectedBlockKey, setTestHand } = slice.actions
export default slice.reducer

export const selectTestConstraint = (state: State, constraint: Constraint) =>
  pipe(state.testHand,
    either.exists(h => satisfies(h)(constraint)))