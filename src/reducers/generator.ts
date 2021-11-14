import { option as O, readonlyArray } from 'fp-ts';
import { observable as Ob, observableEither as ObE, observableOption as ObO } from 'fp-ts-rxjs';
import { constVoid, flow, pipe } from 'fp-ts/lib/function';
import { castDraft } from 'immer';
import { WritableDraft } from 'immer/dist/internal';
import { Epic, StateObservable } from 'redux-observable';
import { concatWith, EMPTY, Observable, of } from 'rxjs';

import { AnyAction, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { RootState } from '../app/store';
import { transpose } from '../model/analyze';
import { AnalysisId, GenerationId, initJobProgress, Job, JobId, JobType, JobTypeGenerateDeals, JobTypeSatisfies, JobTypeSolve, now, updateGenerateDealsProgress, updateSatisfiesProgress, updateSolveProgress, zeroJob } from '../model/job';
import { SerializedBoard, SerializedDeal, serializedDealL } from '../model/serialization';
import { Paths } from '../model/system';
import { ConstrainedBid } from '../model/system/core';
import { ping, postDeals, putDeals } from '../services/server';
import { observeDeals, observeSatisfies, observeSolutions, SatisfiesResult } from '../workers';
import { DoubleDummyResult } from '../workers/dds.worker';

const name = 'generator'
interface State {
  jobs: ReadonlyArray<Job>
  completed: ReadonlyArray<Job>
}
const initialState: State = {
  jobs: [],
  completed: []
}

type InferJobType<T extends JobType["type"]> = Job & { type: JobType & { type: T } }
interface ScheduleJobPayload<T extends JobType["type"]> {
  analysisId: AnalysisId
  type: T
  parameter: InferJobType<T>["type"]["parameter"]
  context: InferJobType<T>["type"]["context"]
  estimatedUnitsInitial: number
}

const slice = createSlice({
  name,
  initialState,
  reducers: {
    scheduleJob: <T extends JobType["type"]>(state: WritableDraft<State>, action: PayloadAction<ScheduleJobPayload<T>>) => {
      state.jobs.push(castDraft(zeroJob(action.payload.analysisId, action.payload.estimatedUnitsInitial, {
        type: action.payload.type,
        parameter: action.payload.parameter,
        context: action.payload.context,
        progress: O.none
      } as JobType)))
    },
    startJob: (state, action: PayloadAction<{ jobId: JobId, type: JobType["type"] }>) => {
      const job = state.jobs.find(j => j.id === action.payload.jobId)
      if (job) {
        job.type.progress = pipe(action.payload.type, initJobProgress, castDraft)
        job.startDate = O.some(now())
        job.running = true
      }
    },
    completeJob: {
      reducer: (state, action: PayloadAction<void, string, JobId, O.Option<string>>) => {
        pipe(state.jobs,
          readonlyArray.findIndex(j => j.id === action.meta),
          O.map(idx => {
            const job = state.jobs[idx]
            job.completedDate = O.some(now())
            job.running = false
            job.error = action.error
            state.completed.push(job)
            state.jobs.splice(idx, 1)
          }))
      },
      prepare: (jobId: JobId, error: O.Option<string>) => ({ payload: constVoid(), meta: jobId, error })
    },
    removeJob: (state, action: PayloadAction<JobId>) => {
      pipe(state.jobs,
        readonlyArray.findIndex(j => j.id === action.payload),
        O.map(idx => state.jobs.splice(idx, 1)))
      pipe(state.completed,
        readonlyArray.findIndex(j => j.id === action.payload),
        O.map(idx => state.completed.splice(idx, 1)))
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
        jobType.progress = pipe(jobType.progress, updateSolveProgress(action.payload.value))
      }
    }
  }
})

export const { scheduleJob, startJob, completeJob, removeJob, reportDeals, reportSatisfies, reportSolutions } = slice.actions
export default slice.reducer

const generateDeals = (generationId: GenerationId, count: number) => (jobId: JobId) => {
  return pipe(observeDeals(count, generationId),
    ObE.map(deals => reportDeals({ jobId, value: deals })),
    ObE.getOrElse((err): Observable<AnyAction> =>
      of(completeJob(jobId, O.some(err)))),
    concatWith([completeJob(jobId, O.none)]))
}

const generateSatisfies = (generationId: GenerationId, paths: Paths<ConstrainedBid>) => (jobId: JobId) =>
  pipe(observeSatisfies(paths)(generationId),
    ObE.map(result => reportSatisfies({ jobId, value: result })),
    ObE.getOrElse((err): Observable<AnyAction> =>
      of(completeJob(jobId, O.some(err)))),
    concatWith([completeJob(jobId, O.none)]))

const generateSolutions = (boards: ReadonlyArray<SerializedBoard>) => (jobId: JobId) =>
  pipe(observeSolutions(boards),
    ObE.map(result => reportSolutions({ jobId, value: result })),
    ObE.getOrElse((err): Observable<AnyAction> =>
      of(completeJob(jobId, O.some(err)))),
    concatWith([completeJob(jobId, O.none)]))

const withJobType = <T extends JobType["type"]>(jobType: T) => (action$: Observable<AnyAction>, state$: StateObservable<RootState>) =>
  action$.pipe(
    Ob.filter(startJob.match),
    Ob.map(a => a.payload),
    Ob.filter((p): p is { jobId: JobId, type: T } => p.type === jobType),
    Ob.map(p =>
      pipe(state$.value.generator.jobs,
        readonlyArray.findFirst(j => j.id === p.jobId),
        O.map(j => j as InferJobType<T>))))

export const epics : ReadonlyArray<Epic<AnyAction, AnyAction, RootState>> = [
  flow(withJobType("GenerateDeals"),
    ObO.fold(() => EMPTY, job => pipe(job.id, generateDeals(job.type.context.generationId, job.type.parameter)))),
  flow(withJobType("Satisfies"),
    ObO.fold(() => EMPTY, job => pipe(job.id, generateSatisfies(job.type.context.generationId, job.type.parameter)))),
  flow(withJobType("Solve"),
    ObO.fold(() => EMPTY, job => pipe(job.id, generateSolutions(job.type.parameter)))),
  flow(Ob.filter(reportDeals.match),
    Ob.map(a => a.payload.value),
    ObE.fromObservable,
    ObE.chainFirst(() => pipe(ping, ObE.fromTaskEither)),
    ObE.chainFirst(flow(
      readonlyArray.map(serializedDealL.reverseGet),
      postDeals,
      ObE.fromTaskEither)),
    Ob.chain(() => EMPTY)),
  flow(Ob.filter(reportSolutions.match),
    Ob.map(a => a.payload.value),
    ObE.fromObservable,
    ObE.chainFirst(() => pipe(ping, ObE.fromTaskEither)),
    ObE.chainFirst(flow(
      readonlyArray.map(x => [serializedDealL.reverseGet(x.board.deal), pipe(x.results, transpose, O.some)] as const),
      putDeals,
      ObE.fromTaskEither)),
    Ob.chain(() => EMPTY))
]
        
// export interface JobIdKeyedState {
//   state: State
//   analysisId: AnalysisId
// }
// const eqJobId: eq.Eq<AnalysisId> = pipe(string.Eq, eq.contramap(uuid => uuid.id))
// export const selectAllDeals = memoize(({ state, analysisId }: JobIdKeyedState) =>
//   pipe(state.collections,
//     readonlyTuple.fst,
//     e => E.elem(eqJobId)(analysisId, e),
//     boolean.fold(
//       () => taskEither.of(readonlyArray.empty),
//       () => getDealsByJobId(analysisId.id)))
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
// export const selectSatisfyCountByJobIdAndPath = memoize(({ state, analysisId, path }: JobIdKeyedState & PathKeyedState) =>
//   pipe(state.collections,
//     readonlyTuple.fst,
//     e => E.elem(eqJobId)(analysisId, e),
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