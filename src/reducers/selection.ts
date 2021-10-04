import * as D from 'io-ts/Decoder'
import * as iso from "monocle-ts/Iso"

import { Card, Hand, eqCard, newDeck, ordCard } from "../model/deck"
import { Constraint, satisfies } from '../model/constraints'
import { Deal, Direction, deal } from "../model/bridge"
import { O, U } from 'ts-toolbelt'
import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit"
import { either, option, readonlyArray, readonlySet } from "fp-ts"
import { flow, pipe } from "fp-ts/lib/function"

import { Either } from 'fp-ts/lib/Either'
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
}
export type AuctionPositionType = O.SelectKeys<State, U.Nullable<DecodedHand>>

const initialState : State = {
  selectedBlockKey: option.none,
}

const getHandByDirection = (dir: Direction) => (d: Deal) =>
  pipe(d[dir], either.right, decodedHandLens.get, castDraft)

const genManyHands = createAsyncThunk('genManyHands', (count: number) =>
  new Promise<ReadonlyArray<Deal>>((resolve, reject) =>
    resolve(readonlyArray.makeBy(count, flow(newDeck, deal)))))

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
  extraReducers: builder =>
    builder.addCase(genManyHands.fulfilled, (state, action) => {
      const d = action.payload[Math.floor(Math.random() * action.payload.length)]
      state['opener'] = getHandByDirection("N")(d)
      state['responder'] = getHandByDirection("S")(d)
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
  