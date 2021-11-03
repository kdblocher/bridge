import { either, option, predicate, readonlyArray, readonlyNonEmptyArray, readonlySet, separated } from 'fp-ts';
import { observable } from 'fp-ts-rxjs';
import { tailRec } from 'fp-ts/lib/ChainRec';
import { constFalse, constTrue, flow, pipe } from 'fp-ts/lib/function';
import { castDraft } from 'immer';
import { WritableDraft } from 'immer/dist/internal';
import memoize from 'proxy-memoize';
import { O } from 'ts-toolbelt';

import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { Board, deal, getHcp } from '../model/bridge';
import { eqCard, Hand, newDeck, ordCardDescending } from '../model/deck';
import { DecodedHand, DecodedSerializedHand, decodedSerializedHandL, serializedBoardL, SerializedHand, serializedHandL } from '../model/serialization';
import { Path, Paths } from '../model/system';
import { ConstrainedBid } from '../model/system/core';
import { satisfiesPath } from '../model/system/satisfaction';
import { decodeHand } from '../parse';
import { observeResultsSerial } from '../workers';
import { DoubleDummyResult } from '../workers/dds.worker';

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

interface Hands {
  opener: SerializedHand
  responder: SerializedHand
}

const setHands = (state: WritableDraft<State>) => (hands: readonly [Hand, Hand]) => {
  const [opener, responder] = hands
  state.opener = pipe(opener, either.right, decodedSerializedHandL.get, castDraft)
  state.responder = pipe(responder, either.right, decodedSerializedHandL.get, castDraft)
}

const genBoardFromHands = (opener: Hand, responder: Hand) =>
  pipe(newDeck(),
    readonlyArray.difference(eqCard)(pipe(opener, readonlySet.toReadonlyArray(ordCardDescending))),
    readonlyArray.difference(eqCard)(pipe(responder, readonlySet.toReadonlyArray(ordCardDescending))),
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

const getResult = createAsyncThunk('abc', ({ opener, responder}: Hands) =>
  pipe(
    genBoardFromHands(serializedHandL.reverseGet(opener), serializedHandL.reverseGet(responder)),
    serializedBoardL.get,
    readonlyNonEmptyArray.of,
    observeResultsSerial,
    observable.toTask,
    t => t()))

const genUntilCondition = (limit: option.Option<number>) => (condition: predicate.Predicate<readonly [Hand, Hand]>) =>
  tailRec(limit, l => {
    if (pipe(l, option.fold(constFalse, i => i === 0))) {
      return either.right(option.none)
    } else {
      const d = deal(newDeck())
      const hands = [d.N, d.S] as const
      const result = condition(hands)
      return result
        ? either.right(option.some(hands))
        : either.left(pipe(l, option.map(i => i - 1)))
    }
  })

const genMatchingOf = (length: predicate.Predicate<number>) => (paths: Paths<ConstrainedBid>) =>
  genUntilCondition(option.some(10000))(hands =>
    pipe(paths,
      readonlyArray.partition(satisfiesPath(...hands)),
      separated.right,
      x => length(x.length)))

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
    genOnce: (state) => {
      pipe(
        genUntilCondition(option.none)(constTrue),
        option.map(setHands(state)))
    },
    getHandsMatchingPath: (state, action: PayloadAction<Path<ConstrainedBid>>) => {
      pipe(
        genUntilCondition(option.some(10000))(hands =>
          satisfiesPath(...hands)(action.payload)),
        option.map(setHands(state)))
    },
    genHandsNotMatchingAnyOf: {
      reducer: (state, action: PayloadAction<readonlyNonEmptyArray.ReadonlyNonEmptyArray<Path<ConstrainedBid>>, string, number>) => {
        pipe(
          genUntilCondition(option.some(10000))(hands =>
            getHcp(hands[0]) >= action.meta
            && pipe(action.payload, readonlyArray.every(predicate.not(satisfiesPath(...hands))))),
          option.map(setHands(state)))
      },
      prepare: (payload: readonlyNonEmptyArray.ReadonlyNonEmptyArray<Path<ConstrainedBid>>, openerMinHcp: number) =>
        ({ payload, meta: openerMinHcp })
    },
    genHandsMatchingExactlyOneOf: (state, action: PayloadAction<readonlyNonEmptyArray.ReadonlyNonEmptyArray<Path<ConstrainedBid>>>) => {
      pipe(
        genMatchingOf(l => l === 1)(action.payload),
        option.map(setHands(state)))
    },
    genHandsMatchingMoreThanOneOf: (state, action: PayloadAction<readonlyNonEmptyArray.ReadonlyNonEmptyArray<Path<ConstrainedBid>>>) => {
      pipe(
        genMatchingOf(l => l > 1)(action.payload),
        option.map(setHands(state)))
    }
  },
  extraReducers: builder => builder
    .addCase(getResult.fulfilled, (state, action) => {
      state.result = pipe(action.payload, castDraft)
    })
  })


export const { setSelectedBlockKey, setHand, genOnce, getHandsMatchingPath, genHandsNotMatchingAnyOf, genHandsMatchingExactlyOneOf, genHandsMatchingMoreThanOneOf } = slice.actions
export { getResult };

export default slice.reducer

export const selectBlockKey = memoize((state: State) =>
  pipe(state.selectedBlockKey,
    option.toNullable))

export const selectHand = memoize(({ state, type } : {state: State, type: AuctionPositionType}) : option.Option<Hand> =>
  pipe(state[type],
    option.fromNullable,
    option.chain(flow(decodedSerializedHandL.reverseGet, option.fromEither))))