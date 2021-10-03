import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { either, option } from "fp-ts"
import { pipe } from "fp-ts/lib/function"
import { castDraft } from "immer"
import * as D from 'io-ts/Decoder'
import { O, U } from 'ts-toolbelt'
import { Constraint, satisfies } from '../model/constraints'
import { decodeHand } from '../parse'

const name = 'selection'
type DecodedHand = ReturnType<typeof decodeHand>
interface State {
  selectedBlockKey: option.Option<string>
  opener?: DecodedHand
  responder?: DecodedHand
}
export type AuctionPositionType = O.SelectKeys<State, U.Nullable<DecodedHand>>

const initialState : State = {
  selectedBlockKey: option.none,
}
const slice = createSlice({
  name,
  initialState,
  reducers: {
    setSelectedBlockKey: (state, action: PayloadAction<option.Option<string>>) => {
      state.selectedBlockKey = action.payload
    },
    setHand: {
      reducer: (state, action: PayloadAction<string, string, AuctionPositionType>) => {
        state[action.meta] = pipe(action.payload, decodeHand, castDraft)
      },
      prepare: (payload, meta) => ({ payload, meta })
    }
  }
})

export const { setSelectedBlockKey, setHand } = slice.actions
export default slice.reducer

export const selectTestConstraint = (state: State, constraint: Constraint) =>
  pipe(state.opener,
    either.fromNullable(D.error(undefined, "No hand defined yet")),
    either.flatten,
    either.exists(hand => satisfies(hand)(constraint)))

export const selectHand = (state: State, type: AuctionPositionType) =>
  pipe(state[type],
    option.fromNullable,
    option.chain(option.fromEither))
  