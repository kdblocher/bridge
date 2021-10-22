import { magma, number, option, readonlyArray, readonlyNonEmptyArray, readonlyRecord, readonlyTuple } from 'fp-ts';
import { observable, observableEither } from 'fp-ts-rxjs';
import { constant, flow, pipe } from 'fp-ts/lib/function';
import { castDraft } from 'immer';
import { Epic } from 'redux-observable';
import { bufferCount, concatWith, EMPTY, filter, from } from 'rxjs';

import { AnyAction, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { RootState } from '../app/store';
import { maxProcessors } from '../lib/concurrency';
import { makeBoard } from '../model/bridge';
import { SerializedBidPath, serializedBidPathL, serializedBoardL, SerializedDeal, serializedDealL } from '../model/serialization';
import { BidPath } from '../model/system';
import { ping, postDeals } from '../services/server';
import { observeDealsParallel, observeDealsSerial, observeResultsParallel, observeResultsSerial } from '../workers';
import { DoubleDummyResult } from '../workers/dds.worker';

const name = 'generator'

type Deals = ReadonlyArray<SerializedDeal>
type Results = readonlyRecord.ReadonlyRecord<SerializedBidPath, readonlyNonEmptyArray.ReadonlyNonEmptyArray<DoubleDummyResult>>
type Progress<T> = readonly [T, number]

const getProgress = <T>(a: T): Progress<T> => [a, 0]
const updateProgress = <T>(M: magma.Magma<T>) => (decrement: number) => (payload: T) => (progress: Progress<T>): Progress<T> =>
  pipe(progress,
    readonlyTuple.bimap(p => p - decrement, current => M.concat(current, payload)))
interface State {
  deals: Progress<Deals>
  results: Progress<Results>
  working: boolean
}
const initialState: State = {
  deals: getProgress([]),
  results: getProgress({}),
  working: false
}

const slice = createSlice({
  name,
  initialState,
  reducers: {
    generate: (state, action: PayloadAction<number>) => {
      state.deals = pipe(state.deals, readonlyTuple.mapSnd(constant(action.payload)), castDraft)
      state.working = true
    },
    getResults: (state, action: PayloadAction<{ path: BidPath, deals: Deals }>) => {
      state.results = pipe(state.results, readonlyTuple.mapSnd(constant(action.payload.deals.length)), castDraft)
      state.working = true
    },
    reportDeals: (state, action: PayloadAction<Deals>) => {
      state.deals = pipe(state.deals,
        updateProgress
          (readonlyArray.getSemigroup<SerializedDeal>())
          (action.payload.length)
          (action.payload),
        castDraft)
    },
    reportResults: (state, action: PayloadAction<Results>) => {
      state.results = pipe(state.results,
        updateProgress
          (readonlyRecord.getUnionSemigroup(readonlyNonEmptyArray.getSemigroup<DoubleDummyResult>()))
          (pipe(action.payload,
            readonlyRecord.toReadonlyArray,
            readonlyArray.foldMap(number.MonoidSum)(([_, values]) => values.length)))
          (action.payload),
        castDraft)
    },
    done: (state) => {
      state.working = false
    }
  }
})

export const { generate, getResults, reportDeals, reportResults, done } = slice.actions
export default slice.reducer

type E = Epic<AnyAction, AnyAction, RootState>
export const analyzeDealsEpic : E = (action$, state$) =>
  action$.pipe(
    filter(generate.match),
    observable.map(a => a.payload),
    observable.chain(flow(
      count => count > maxProcessors
        ? pipe(observeDealsParallel(count), observable.flatten)
        : observeDealsSerial(count),
      bufferCount(1000),
      observable.map(reportDeals),
      concatWith([done()]))))

export const analyzeResultsEpic : E = (action$, state$) =>
  action$.pipe(
    filter(getResults.match),
    observable.chain(a =>
      pipe(
        a.payload.deals,
        readonlyArray.mapWithIndex((i, d) =>
          pipe(d,
            serializedDealL.reverseGet,
            makeBoard(i + 1),
            serializedBoardL.get)),
        readonlyNonEmptyArray.fromReadonlyArray,
        option.fold(() => from([]),
          boards =>
            a.payload.deals.length > maxProcessors
            ? pipe(boards, observeResultsParallel, observable.flatten)
            : pipe(boards, observeResultsSerial)),
        bufferCount(5),
        observable.map(flow(
          readonlyNonEmptyArray.fromReadonlyArray,
          option.fold(
            () => reportResults({}),
            results => pipe(
              a.payload.path,
              readonlyNonEmptyArray.map(a => a.bid ),
              serializedBidPathL.get,
              path => reportResults(({ [path]: results })))))),
        concatWith([done()]))))

export const saveToApiEpic: Epic<AnyAction> = (action$, state$) =>
  action$.pipe(
    filter(reportDeals.match),
    observable.map(a => a.payload),
    observableEither.fromObservable,
    observableEither.chainFirst(() => pipe(ping, observableEither.fromTaskEither)),
    observableEither.chainFirst(flow(
      readonlyArray.map(serializedDealL.reverseGet),
      postDeals,
      observableEither.fromTaskEither)),
    observable.chain(_ => EMPTY))
        
export const selectAllDeals = (state: State) =>
  pipe(state.deals,
    readonlyTuple.fst)

export const selectAllNorthSouthPairs =
  flow(
    selectAllDeals,
    readonlyArray.map(flow(
      serializedDealL.reverseGet,
      deal => [deal.N, deal.S] as const)))

export const selectProgress = (state: State) => ({
  deals: state.deals[1],
  results: state.results[1],
})

export const selectResultsByPath = (state: State, path: SerializedBidPath) =>
  pipe(state.results[0],
    readonlyRecord.lookup(path),
    option.toNullable)