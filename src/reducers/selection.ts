import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { either, option, readonlyArray, readonlySet } from "fp-ts"
import { flow, pipe } from "fp-ts/lib/function"
import { castDraft } from "immer"
import * as D from 'io-ts/Decoder'
import { O } from 'ts-toolbelt'
import dds, { DoubleDummyResult } from '../lib/dds/dds'
import { Board, Deal, deal, Direction } from "../model/bridge"
import { Constraint, satisfies } from '../model/constraints'
import { eqCard, Hand, newDeck, ordCard } from "../model/deck"
import { DecodedHand, DecodedSerializedHand, decodedSerializedHandL } from "../model/serialization"
import { decodeHand } from '../parse'



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

const genBoardFromHands = (state: State) =>
  pipe(option.Do,
    option.apS('opener', selectHand(state, 'opener')),
    option.apS('responder', selectHand(state, 'responder')),
    option.map(o => pipe(newDeck(),
      readonlyArray.difference(eqCard)(pipe(o.opener, readonlySet.toReadonlyArray(ordCard))),
      readonlyArray.difference(eqCard)(pipe(o.responder, readonlySet.toReadonlyArray(ordCard))),
      readonlyArray.chunksOf(13),
      readonlyArray.map(readonlySet.fromReadonlyArray(eqCard)),
      ([l, r]) : Board => ({
        dealer: 'N',
        deal: {
          N: o.opener,
          S: o.responder,
          E: l,
          W: r
        }
      }))))

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
    genResult: (state) => {
      state.result = pipe(state,
        genBoardFromHands,
        option.map(dds),
        option.toUndefined,
        castDraft)
    }
  }
})

export const { setSelectedBlockKey, setHand, genHands, genResult } = slice.actions

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
  