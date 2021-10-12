import * as D from 'io-ts/Decoder'

import { Board, Deal, Direction, deal } from "../model/bridge"
import { Constraint, satisfies } from '../model/constraints'
import { DecodedHand, DecodedSerializedHand, SerializedHand, decodedSerializedHandL, serializedBoardL, serializedHandL } from "../model/serialization"
import { Hand, eqCard, newDeck, ordCard } from "../model/deck"
import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit"
import { either, option, readonlyArray, readonlySet, task } from "fp-ts"
import { flow, pipe } from "fp-ts/lib/function"

import { DoubleDummyResult } from '../model/analyze'
import { O } from 'ts-toolbelt'
import { castDraft } from "immer"
import { decodeHand } from '../parse'
import { makeGetResultsTask } from "../workers"

const name = 'selection'

interface State {
  selectedBlockKey: option.Option<string>
  opener?: DecodedSerializedHand
  responder?: DecodedSerializedHand
  result?: DoubleDummyResult
}
export type AuctionPositionType = O.SelectKeys<State, DecodedHand>

const initialState : State = {
  selectedBlockKey: option.none
}

const getHandByDirection = (dir: Direction) => (d: Deal) =>
  pipe(d[dir], either.right, decodedSerializedHandL.get, castDraft)

interface Hands {
  opener: SerializedHand
  responder: SerializedHand
}

const getResult = createAsyncThunk('abc', ({ opener, responder}: Hands) =>
  pipe(
    genBoardFromHands(serializedHandL.reverseGet(opener), serializedHandL.reverseGet(responder)),
    serializedBoardL.get,
    readonlyArray.of,
    makeGetResultsTask,
    task.map(r => r[0]),
    t => t()))

const genBoardFromHands = (opener: Hand, responder: Hand) =>
  pipe(newDeck(),
    readonlyArray.difference(eqCard)(pipe(opener, readonlySet.toReadonlyArray(ordCard))),
    readonlyArray.difference(eqCard)(pipe(responder, readonlySet.toReadonlyArray(ordCard))),
    readonlyArray.chunksOf(13),
    readonlyArray.map(readonlySet.fromReadonlyArray(eqCard)),
    ([l, r]) : Board => ({
      dealer: 'N',
      deal: {
        N: opener,
        S: responder,
        E: l,
        W: r
      }
    }))

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
    },
  },
  extraReducers: builder => builder
    .addCase(getResult.fulfilled, (state, action) => {
      state.result = pipe(action.payload, castDraft)
    })
  })


export const { setSelectedBlockKey, setHand, genHands } = slice.actions
export { getResult }

export default slice.reducer

export const selectTestConstraint = (state: State, constraint: Constraint) : boolean =>
  pipe(state.opener,
    either.fromNullable(D.error(undefined, "No hand defined yet")),
    either.flatten,
    decodedSerializedHandL.reverseGet,
    either.exists(satisfies(constraint)))

export const selectHand = (state: State, type: AuctionPositionType) : option.Option<Hand> =>
  pipe(state[type],
    option.fromNullable,
    option.chain(flow(decodedSerializedHandL.reverseGet, option.fromEither)))
  