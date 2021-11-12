import { either as E, option as O, readonlyArray } from 'fp-ts';
import { observable, observableEither, observableOption } from 'fp-ts-rxjs';
import { constVoid, flow, pipe } from 'fp-ts/lib/function';
import { castDraft } from 'immer';
import { WritableDraft } from 'immer/dist/internal';
import { Epic, StateObservable } from 'redux-observable';
import { concatWith, EMPTY, filter, Observable, of } from 'rxjs';
import { UuidTool } from 'uuid-tool';

import { AnyAction, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { RootState } from '../app/store';
import { transpose } from '../model/analyze';
import { CollectionId, Job, JobId, JobType, JobTypeGenerateDeals, JobTypeSatisfies, JobTypeSolve, updateGenerateDealsProgress, updateSatisfiesProgress, updateSolvedProgress, zeroJob } from '../model/job';
import { SerializedBoard, SerializedDeal, serializedDealL } from '../model/serialization';
import { Paths } from '../model/system';
import { ConstrainedBid } from '../model/system/core';
import { ping, postDeals, putDeals } from '../services/server';
import { observeDeals, observeSatisfies, observeSolutions, SatisfiesResult } from '../workers';
import { DoubleDummyResult } from '../workers/dds.worker';

const name = 'generator'

interface State {
  jobs: ReadonlyArray<Job>
  completed: ReadonlyArray<E.Either<string, Job>>
}
const initialState: State = {
  jobs: [],
  completed: []
}

type JobParameter<T extends JobType["type"]> = T extends { parameter: infer U } ? U : never
interface ScheduleJobPayload<T extends JobType["type"]> {
  collectionId: CollectionId
  type: T
  parameter: JobParameter<T>
  estimatedUnitsInitial: number
}

const slice = createSlice({
  name,
  initialState,
  reducers: {
    schedule: <T extends JobType["type"]>(state: WritableDraft<State>, action: PayloadAction<ScheduleJobPayload<T>>) => {
      state.jobs.push(castDraft(zeroJob(action.payload.collectionId, action.payload.estimatedUnitsInitial, {
        type: action.payload.type,
        parameter: action.payload.parameter,
        progress: O.none
      } as JobType)))
    },
    start: (state, action: PayloadAction<{ jobId: JobId, type: JobType["type"] }>) => {
      const job = state.jobs.find(j => j.id === action.payload.jobId)
      if (job) {
        job.startDate = O.some(new Date())
        job.running = true
      }
    },
    complete: {
      reducer: (state, action: PayloadAction<void, string, JobId, O.Option<string>>) => {
        const job = state.jobs.find(j => j.id === action.meta)
        if (job) {
          job.completedDate = O.some(new Date())
          job.running = false
          job.error = action.error
        }
      },
      prepare: (jobId: JobId, error: O.Option<string>) => ({ payload: constVoid(), meta: jobId, error })
    },
    reportDeals: (state, action: PayloadAction<{ jobId: JobId, value: ReadonlyArray<SerializedDeal> }>) => {
      const jobType = state.jobs.find(j => j.id === action.payload.jobId)?.type as JobTypeGenerateDeals
      if (jobType) {
        jobType.progress = pipe(jobType.progress, updateGenerateDealsProgress(action.payload.value))
      }
    },
    reportSatisfies: (state, action: PayloadAction<{ jobId: JobId, value: SatisfiesResult }>) => {
      const jobType = state.jobs.find(j => j.id === action.payload.jobId)?.type as JobTypeSatisfies
      if (jobType) {
        jobType.progress = pipe(jobType.progress, updateSatisfiesProgress(action.payload.value))
      }
    },
    reportSolutions: (state, action: PayloadAction<{ jobId: JobId, value: ReadonlyArray<DoubleDummyResult> }>) => {
      const jobType = state.jobs.find(j => j.id === action.payload.jobId)?.type as JobTypeSolve
      if (jobType) {
        jobType.progress = pipe(jobType.progress, updateSolvedProgress(action.payload.value))
      }
    }
  }
})

export const { schedule, start, complete, reportDeals, reportSatisfies, reportSolutions } = slice.actions
export default slice.reducer

const generateDeals = (count: number) => (jobId: JobId) => {
  const generationId = UuidTool.newUuid()
  return pipe(observeDeals(count, generationId),
    observableEither.map(deals => reportDeals({ jobId, value: deals })),
    observableEither.getOrElse((err): Observable<AnyAction> =>
      of(complete(jobId, O.some(err)))),
    concatWith([complete(jobId, O.none)]))
}

const generateSatisfies = (paths: Paths<ConstrainedBid>) => (jobId: JobId) =>
  pipe(observeSatisfies(paths)(jobId),
    observableEither.map(result => reportSatisfies({ jobId, value: result })),
    observableEither.getOrElse((err): Observable<AnyAction> =>
      of(complete(jobId, O.some(err)))),
    concatWith([complete(jobId, O.none)]))

const generateSolutions = (boards: ReadonlyArray<SerializedBoard>) => (jobId: JobId) =>
  pipe(observeSolutions(boards),
    observableEither.map(result => reportSolutions({ jobId, value: result })),
    observableEither.getOrElse((err): Observable<AnyAction> =>
      of(complete(jobId, O.some(err)))),
    concatWith([complete(jobId, O.none)]))

type InferJobType<T extends JobType["type"]> = Job & { type: JobType & { type: T } }
const withJobType = <T extends JobType["type"]>(jobType: T) => (action$: Observable<AnyAction>, state$: StateObservable<RootState>) =>
  action$.pipe(
    observable.filter(start.match),
    observable.map(a => a.payload),
    observable.filter((p): p is { jobId: JobId, type: T } => p.type === jobType),
    observable.map(p =>
      pipe(state$.value.generator.jobs,
        readonlyArray.findFirst(j => j.id === p.jobId),
        O.map(j => j as InferJobType<T>))))

export const analyzeDealsEpic : Epic<AnyAction, AnyAction, RootState> =
  flow(withJobType("GenerateDeals"),
    observableOption.fold(() => EMPTY, job => pipe(job.id, generateDeals(job.type.parameter))))

export const analyzeSatisfiesEpic : Epic<AnyAction, AnyAction, RootState> =
  flow(withJobType("Satisfies"),
    observableOption.fold(() => EMPTY, job => pipe(job.id, generateSatisfies(job.type.parameter))))

export const analyzeResultsEpic : Epic<AnyAction, AnyAction, RootState> =
  flow(withJobType("Solve"),
    observableOption.fold(() => EMPTY, job => pipe(job.id, generateSolutions(job.type.parameter))))

export const saveDealsToApiEpic: Epic<AnyAction> = (action$, state$) =>
  action$.pipe(
    filter(reportDeals.match),
    observable.map(a => a.payload.value),
    observableEither.fromObservable,
    observableEither.chainFirst(() => pipe(ping, observableEither.fromTaskEither)),
    observableEither.chainFirst(flow(
      readonlyArray.map(serializedDealL.reverseGet),
      postDeals,
      observableEither.fromTaskEither)),
    observable.chain(() => EMPTY))

export const saveSolutionsToApiEpic: Epic<AnyAction> = (action$, state$) =>
  action$.pipe(
    filter(reportSolutions.match),
    observable.map(a => a.payload.value),
    observableEither.fromObservable,
    observableEither.chainFirst(() => pipe(ping, observableEither.fromTaskEither)),
    observableEither.chainFirst(flow(
      readonlyArray.map(x => [serializedDealL.reverseGet(x.board.deal), pipe(x.results, transpose, O.some)] as const),
      putDeals,
      observableEither.fromTaskEither)),
    observable.chain(() => EMPTY))
        
// export interface JobIdKeyedState {
//   state: State
//   collectionId: CollectionId
// }
// const eqJobId: eq.Eq<CollectionId> = pipe(string.Eq, eq.contramap(uuid => uuid.id))
// export const selectAllDeals = memoize(({ state, collectionId }: JobIdKeyedState) =>
//   pipe(state.collections,
//     readonlyTuple.fst,
//     e => E.elem(eqJobId)(collectionId, e),
//     boolean.fold(
//       () => taskEither.of(readonlyArray.empty),
//       () => getDealsByJobId(collectionId.id)))
//     ())

// export const selectProgress = memoize((state: State) => ({
//   deals: state.collections[1],
//   satisfies: state.satisfies[1],
//   results: state.results[1],
// }))

// interface PathKeyedState {
//   state: State
//   path: SerializedBidPath
// }
// export const selectSatisfyCountByJobIdAndPath = memoize(({ state, collectionId, path }: JobIdKeyedState & PathKeyedState) =>
//   pipe(state.collections,
//     readonlyTuple.fst,
//     e => E.elem(eqJobId)(collectionId, e),
//     boolean.fold(
//       () => null,
//       () => pipe(
//         state.satisfies[0],
//         RR.lookup(path),
//         O.toNullable))))

// export const selectResultsByPath = memoize(({ state, path }: PathKeyedState) =>
//   pipe(state.results[0],
//     RR.lookup(path),
//     O.toNullable))