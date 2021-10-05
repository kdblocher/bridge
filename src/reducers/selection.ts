import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { either, option } from "fp-ts"
import { flow, pipe } from "fp-ts/lib/function"
import { castDraft } from "immer"
import * as D from 'io-ts/Decoder'
import { O, U } from 'ts-toolbelt'
import { Deal, deal, Direction } from "../model/bridge"
import { Constraint, satisfies } from '../model/constraints'
import { Hand, newDeck } from "../model/deck"
import { DecodedHand, DecodedSerializedHand, decodedSerializedHandL } from "../model/serialization"
import { decodeHand } from '../parse'

const name = 'selection'

interface State {
  selectedBlockKey: option.Option<string>
  opener?: DecodedSerializedHand
  responder?: DecodedSerializedHand
}
export type AuctionPositionType = O.SelectKeys<State, U.Nullable<DecodedHand>>

const initialState : State = {
  selectedBlockKey: option.none
}

const getHandByDirection = (dir: Direction) => (d: Deal) =>
  pipe(d[dir], either.right, decodedSerializedHandL.get, castDraft)

const slice = createSlice({
  name,
  initialState,
  reducers: {
    setSelectedBlockKey: (state, action: PayloadAction<option.Option<string>>) => {
      state.selectedBlockKey = action.payload
    },
    setHand: {
      reducer: (state, action: PayloadAction<string, string, AuctionPositionType>) => {
        state[action.meta] = pipe(action.payload, decodeHand, decodedSerializedHandL.get, castDraft)
      },
      prepare: (payload, meta) => ({ payload, meta })
    },
    genHands: (state) => {
      const d = deal(newDeck())
      state['opener'] = getHandByDirection("N")(d)
      state['responder'] = getHandByDirection("S")(d)
    }
  }
})

export const { setSelectedBlockKey, setHand, genHands } = slice.actions

export default slice.reducer

export const selectTestConstraint = (state: State, constraint: Constraint) : boolean =>
  pipe(state.opener,
    either.fromNullable(D.error(undefined, "No hand defined yet")),
    either.flatten,
    decodedSerializedHandL.reverseGet,
    either.exists(hand => satisfies(hand)(constraint)))

export const selectHand = (state: State, type: AuctionPositionType) : option.Option<Hand> =>
  pipe(state[type],
    option.fromNullable,
    option.chain(flow(decodedSerializedHandL.reverseGet, option.fromEither)))
  