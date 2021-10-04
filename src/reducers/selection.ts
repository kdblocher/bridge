import * as D from 'io-ts/Decoder'
import * as iso from "monocle-ts/Iso"

import { Card, Hand, eqCard, newDeck, ordCard } from "../model/deck"
import { Constraint, satisfies } from '../model/constraints'
import { Deal, Direction, deal } from "../model/bridge"
import { O, U } from 'ts-toolbelt'
import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit"
import { constant, flow, pipe } from "fp-ts/lib/function"
import { either, option, readonlyArray, readonlySet, task } from "fp-ts"

import { Either } from 'fp-ts/lib/Either'
import Worker from './worker'
import { castDraft } from "immer"
import { decodeHand } from '../parse'

const name = 'selection'
type DecodedHand = ReturnType<typeof decodeHand>
type SerializedHand = ReadonlyArray<Card>
type DecodedSerializedHand = DecodedHand extends Either<infer L, unknown> ? either.Either<L, SerializedHand> : never

const handLens = iso.iso<Hand, SerializedHand>(
  readonlySet.toReadonlyArray(ordCard),
  readonlySet.fromReadonlyArray(eqCard)
)
const lift = <E>() => <A, B>(i: iso.Iso<A, B>) => iso.iso<Either<E, A>, Either<E, B>>(either.map(i.get), either.map(i.reverseGet))
const decodedHandLens = lift<D.DecodeError>()(handLens)

interface State {
  selectedBlockKey: option.Option<string>
  opener?: DecodedSerializedHand
  responder?: DecodedSerializedHand
  generating: boolean
}
export type AuctionPositionType = O.SelectKeys<State, U.Nullable<DecodedHand>>

const initialState : State = {
  selectedBlockKey: option.none,
  generating: false
}

const maxProcessors = window.navigator.hardwareConcurrency
const genManyHands = createAsyncThunk('genManyHands', async (count: number) => {
  const handsPerWorker = count / maxProcessors
  const remainder = count % maxProcessors
  // return new Worker().genDeals(count)
  const makeTask = (count: number) => () => new Worker().genDeals(count)
  return pipe(readonlyArray.makeBy(maxProcessors - 1, constant(makeTask(handsPerWorker))),
    readonlyArray.prepend(makeTask(handsPerWorker + remainder)),
    task.sequenceArray,
    task.map(readonlyArray.flatten),
    task => task())
})

const getHandByDirection = (dir: Direction) => (d: Deal) =>
  pipe(d[dir], either.right, decodedHandLens.get, castDraft)

const slice = createSlice({
  name,
  initialState,
  reducers: {
    setSelectedBlockKey: (state, action: PayloadAction<option.Option<string>>) => {
      state.selectedBlockKey = action.payload
    },
    setHand: {
      reducer: (state, action: PayloadAction<string, string, AuctionPositionType>) => {
        state[action.meta] = pipe(action.payload, decodeHand, decodedHandLens.get, castDraft)
      },
      prepare: (payload, meta) => ({ payload, meta })
    },
    genHands: (state) => {
      const d = deal(newDeck())
      state['opener'] = getHandByDirection("N")(d)
      state['responder'] = getHandByDirection("S")(d)
    }
  },
  extraReducers: builder => builder
    .addCase(genManyHands.pending, (state) => {
      state.generating = true
    })
    .addCase(genManyHands.fulfilled, (state, action) => {
      const d = action.payload[Math.floor(Math.random() * action.payload.length)]
      state['opener'] = getHandByDirection("N")(d)
      state['responder'] = getHandByDirection("S")(d)
      state.generating = false
    })
    .addCase(genManyHands.rejected, (state) => {
      state.generating = false
    })
})

export const { setSelectedBlockKey, setHand, genHands } = slice.actions
export { genManyHands }

export default slice.reducer

export const selectTestConstraint = (state: State, constraint: Constraint) : boolean =>
  pipe(state.opener,
    either.fromNullable(D.error(undefined, "No hand defined yet")),
    either.flatten,
    decodedHandLens.reverseGet,
    either.exists(hand => satisfies(hand)(constraint)))

export const selectHand = (state: State, type: AuctionPositionType) : option.Option<Hand> =>
  pipe(state[type],
    option.fromNullable,
    option.chain(flow(decodedHandLens.reverseGet, option.fromEither)))
  