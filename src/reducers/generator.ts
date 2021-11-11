import { boolean, either, eq, magma, number, option as O, readonlyArray, readonlyNonEmptyArray, readonlyRecord, readonlyTuple, semigroup, string, taskEither } from 'fp-ts';
import { observable, observableEither } from 'fp-ts-rxjs';
import { constant, flow, pipe } from 'fp-ts/lib/function';
import { castDraft } from 'immer';
import memoize from 'proxy-memoize';
import { Epic } from 'redux-observable';
import { bufferCount, concatWith, EMPTY, filter, from, Observable, of, tap } from 'rxjs';
import { UuidLike, UuidTool } from 'uuid-tool';

import { AnyAction, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { RootState } from '../app/store';
import { transpose } from '../model/analyze';
import { makeBoard } from '../model/bridge';
import { SerializedBidPath, serializedBidPathL, serializedBoardL, SerializedDeal, serializedDealL } from '../model/serialization';
import { Path, Paths } from '../model/system';
import { ConstrainedBid } from '../model/system/core';
import { getDealsByJobId } from '../services/idb';
import { ping, postDeals, putDeals } from '../services/server';
import { observeDeals, observeResults, observeSatisfies, SatisfiesResult } from '../workers';
import { DoubleDummyResult } from '../workers/dds.worker';

const name = 'generator'

type Deals = ReadonlyArray<SerializedDeal>
type Results = readonlyRecord.ReadonlyRecord<SerializedBidPath, readonlyNonEmptyArray.ReadonlyNonEmptyArray<DoubleDummyResult>>
type Satisfies = readonlyRecord.ReadonlyRecord<SerializedBidPath, number>
type Progress<T> = readonly [T, number]
type JobId = UuidLike

const getProgress = <T>(a: T): Progress<T> => [a, 0]
const updateProgress = <T>(M: magma.Magma<T>) => (decrement: number) => (payload: T) => (progress: Progress<T>): Progress<T> =>
  pipe(progress,
    readonlyTuple.bimap(p => p - decrement, current => M.concat(current, payload)))

interface State {
  deals: Progress<either.Either<string, JobId>>
  satisfies: Progress<Satisfies>
  results: Progress<Results>
  working: boolean
}
const initialState: State = {
  deals: getProgress(either.left("Initial")),
  satisfies: getProgress({}),
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
    reportDeals: (state, action: PayloadAction<Deals>) => {
      state.deals = pipe(state.deals,
        updateProgress
          (either.getSemigroup<string, JobId>(semigroup.first<JobId>()))
          (action.payload.length)
          (either.left("Generating")),
        castDraft)
    },

    getSatisfies: (state, action: PayloadAction<{ paths: Paths<ConstrainedBid>, jobId: JobId }>) => {
      state.satisfies = [{}, 0]
      state.working = true
    },
    reportSatisfies: (state, action: PayloadAction<SatisfiesResult>) => {
      state.satisfies = pipe(state.satisfies,
        updateProgress
          (readonlyRecord.getUnionSemigroup(number.MonoidSum))
          (-1)
          ({ [action.payload.path]: action.payload.count }),
        castDraft)
    },

    getResults: (state, action: PayloadAction<{ path: Path<ConstrainedBid>, deals: Deals }>) => {
      state.results = pipe(state.results, readonlyTuple.mapSnd(constant(action.payload.deals.length)), castDraft)
      state.working = true
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

    done: (state, action: PayloadAction<either.Either<string, JobId>>) => {
      state.deals = pipe(state.deals, updateProgress
        (either.getSemigroup<string, JobId>(semigroup.first<JobId>()))
        (0)
        (action.payload),
        castDraft)
      state.working = false
    }
  }
})

export const { generate, reportDeals, getSatisfies, reportSatisfies, getResults, reportResults, done } = slice.actions
export default slice.reducer

type E = Epic<AnyAction, AnyAction, RootState>
export const analyzeDealsEpic : E = (action$, state$) =>
  action$.pipe(
    filter(generate.match),
    observable.map(a => a.payload),
    observable.chain(count => {
      const jobId = UuidTool.newUuid()
      return pipe(observeDeals(count, jobId),
        observableEither.map(reportDeals),
        observableEither.getOrElse((err): Observable<AnyAction> =>
          of(done(either.left(err)))),
        concatWith([done(either.right({ id: jobId }))]))
    }))

export const analyzeSatisfiesEpic : E = (action$, state$) =>
  action$.pipe(
    filter(getSatisfies.match),
    observable.map(a => a.payload),
    observable.chain(({ paths, jobId }) =>
      pipe(observeSatisfies(paths)(jobId.id),
        observableEither.map(reportSatisfies),
        observableEither.getOrElse((err): Observable<AnyAction> =>
          of(done(either.left(err)))),
        concatWith([done(either.right(jobId))]))))

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
        O.fold(() => from([]), observeResults),
        bufferCount(5),
        observable.map(flow(
          readonlyNonEmptyArray.fromReadonlyArray,
          O.fold(
            () => reportResults({}),
            results => pipe(
              a.payload.path,
              readonlyNonEmptyArray.map(a => a.bid ),
              serializedBidPathL.get,
              path => reportResults(({ [path]: results })))))),
        concatWith([done(either.right({ id: "" }))]))))

export const saveDealsToApiEpic: Epic<AnyAction> = (action$, state$) =>
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

export const saveSolutionsToApiEpic: Epic<AnyAction> = (action$, state$) =>
  action$.pipe(
    filter(reportResults.match),
    observable.map(a => a.payload),
    observableEither.fromObservable,
    observableEither.chainFirst(() => pipe(ping, observableEither.fromTaskEither)),
    observableEither.chainFirst(flow(
      readonlyRecord.toReadonlyArray,
      readonlyArray.chain(readonlyTuple.snd),
      readonlyArray.map(x => [serializedDealL.reverseGet(x.board.deal), pipe(x.results, transpose, O.some)] as const),
      putDeals,
      observableEither.fromTaskEither)),
    observable.chain(_ => EMPTY))    
        
export interface JobIdKeyedState {
  state: State
  jobId: JobId
}
const eqJobId: eq.Eq<JobId> = pipe(string.Eq, eq.contramap(uuid => uuid.id))
export const selectAllDeals = memoize(({ state, jobId }: JobIdKeyedState) =>
  pipe(state.deals,
    readonlyTuple.fst,
    e => either.elem(eqJobId)(jobId, e),
    boolean.fold(
      () => taskEither.of(readonlyArray.empty),
      () => getDealsByJobId(jobId.id)))
    ())

export const selectProgress = memoize((state: State) => ({
  deals: state.deals[1],
  satisfies: state.satisfies[1],
  results: state.results[1],
}))

interface PathKeyedState {
  state: State
  path: SerializedBidPath
}
export const selectSatisfyCountByJobIdAndPath = memoize(({ state, jobId, path }: JobIdKeyedState & PathKeyedState) =>
  pipe(state.deals,
    readonlyTuple.fst,
    e => either.elem(eqJobId)(jobId, e),
    boolean.fold(
      () => null,
      () => pipe(
        state.satisfies[0],
        readonlyRecord.lookup(path),
        O.toNullable))))

export const selectResultsByPath = memoize(({ state, path }: PathKeyedState) =>
  pipe(state.results[0],
    readonlyRecord.lookup(path),
    O.toNullable))