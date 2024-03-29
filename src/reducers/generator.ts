import { option as O, readonlyArray as RA } from 'fp-ts';
import { observable as Ob, observableEither as ObE, observableOption as ObO } from 'fp-ts-rxjs';
import { constVoid, flow, pipe } from 'fp-ts/lib/function';
import { castDraft } from 'immer';
import { WritableDraft } from 'immer/dist/internal';
import memoize from 'proxy-memoize';
import { Epic, StateObservable } from 'redux-observable';
import { concatWith, EMPTY, Observable, of } from 'rxjs';

import { AnyAction, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { RootState } from '../app/store';
import { AnalysisId, GenerationId, initJobProgress, Job, JobDetailsMap, JobId, JobTypeGenerateDeals, JobTypeSatisfies, JobTypeSolve, now, Solution, updateGenerateDealsProgress, updateSatisfiesProgress, updateSolveProgress, zeroJob } from '../model/job';
import { SerializedDeal } from '../model/serialization';
import { Paths } from '../model/system';
import { ConstrainedBid } from '../model/system/core';
import { observeDeals, observeSatisfies, observeSolutions, SatisfiesResult } from '../workers';

const name = 'generator'
interface State {
  jobs: ReadonlyArray<Job>
  completed: ReadonlyArray<Job>
}
const initialState: State = {
  jobs: [],
  completed: []
}

interface ScheduleJobPayload<T extends keyof JobDetailsMap, P extends JobDetailsMap[T]> {
  analysisId: AnalysisId
  type: T
  parameter: P["parameter"]
  context: P["context"]
  estimatedUnitsInitial: number
}

const slice = createSlice({
  name,
  initialState,
  reducers: {
    scheduleJob: <K extends keyof JobDetailsMap, D extends JobDetailsMap[K]>(state: WritableDraft<State>, action: PayloadAction<ScheduleJobPayload<K, D>>) => {
      const job = zeroJob<K>(
        action.payload.analysisId,
        action.payload.estimatedUnitsInitial,
        action.payload.type,
        {
          parameter: action.payload.parameter,
          context: action.payload.context,
          progress: O.none
        } as D
      )
      state.jobs.push(castDraft(job) as WritableDraft<Job>)
    },
    startJob: (state, action: PayloadAction<{ jobId: JobId, type: Job["type"] }>) => {
      const job = state.jobs.find(j => j.id === action.payload.jobId)
      if (job) {
        job.details.progress = pipe(action.payload.type, initJobProgress, castDraft)
        job.startDate = O.some(now())
        job.running = true
      }
    },
    completeJob: {
      reducer: (state, action: PayloadAction<void, string, JobId, O.Option<string>>) => {
        pipe(state.jobs,
          RA.findIndex(j => j.id === action.meta),
          O.map(idx => {
            const job = state.jobs[idx]
            job.completedDate = O.some(now())
            job.running = false
            job.error = action.error
            state.completed.push(job)
            state.jobs.splice(idx, 1)
            return job
          }))
      },
      prepare: (jobId: JobId, error: O.Option<string>) => ({ payload: constVoid(), meta: jobId, error })
    },
    removeJob: (state, action: PayloadAction<JobId>) => {
      pipe(state.jobs,
        RA.findIndex(j => j.id === action.payload),
        O.map(idx => state.jobs.splice(idx, 1)))
      pipe(state.completed,
        RA.findIndex(j => j.id === action.payload),
        O.map(idx => state.completed.splice(idx, 1)))
    },
    reportDeals: (state, action: PayloadAction<{ jobId: JobId, value: ReadonlyArray<SerializedDeal> }>) => {
      const jobType = state.jobs.find(j => j.id === action.payload.jobId)?.details as JobTypeGenerateDeals
      if (jobType) {
        jobType.progress = pipe(jobType.progress, updateGenerateDealsProgress(action.payload.value))
      }
    },
    reportSatisfies: (state, action: PayloadAction<{ jobId: JobId, value: SatisfiesResult }>) => {
      const jobType = state.jobs.find(j => j.id === action.payload.jobId)?.details as JobTypeSatisfies
      if (jobType) {
        jobType.progress = pipe(jobType.progress, updateSatisfiesProgress(action.payload.value))
      }
    },
    reportSolutions: (state, action: PayloadAction<{ jobId: JobId, value: Solution }>) => {
      const jobType = state.jobs.find(j => j.id === action.payload.jobId)?.details as JobTypeSolve
      if (jobType) {
        jobType.progress = pipe(jobType.progress, updateSolveProgress(action.payload.value))
      }
    }
  }
})

export const { scheduleJob, startJob, completeJob, removeJob, reportDeals, reportSatisfies, reportSolutions } = slice.actions
export default slice.reducer

interface JobIndex {
  state: State
  jobId: JobId
}
export const selectJobById = memoize((idx: JobIndex) =>
  pipe(idx.state.jobs,
    RA.findFirst(j => j.id === idx.jobId)))

const generateDeals = (jobId: JobId, generationId: GenerationId, count: number) =>
  pipe(observeDeals(generationId)(count),
    ObE.map(deals => reportDeals({ jobId, value: deals })),
    ObE.getOrElse((err): Observable<AnyAction> =>
      of(completeJob(jobId, O.some(err)))),
    concatWith([completeJob(jobId, O.none)]))

const generateSatisfies = (jobId: JobId, generationId: GenerationId, paths: Paths<ConstrainedBid>) =>
  pipe(observeSatisfies(generationId)(paths),
    ObE.map(result => reportSatisfies({ jobId, value: result })),
    ObE.getOrElse((err): Observable<AnyAction> =>
      of(completeJob(jobId, O.some(err)))),
    concatWith([completeJob(jobId, O.none)]))

const generateSolutions = (jobId: JobId, generationId: GenerationId, deals: ReadonlyArray<SerializedDeal>) =>
  pipe(observeSolutions(deals),
    ObE.map(result => reportSolutions({ jobId, value: result })),
    ObE.getOrElse((err): Observable<AnyAction> =>
      of(completeJob(jobId, O.some(err)))),
    concatWith([completeJob(jobId, O.none)]))

const withJobType = <T extends keyof JobDetailsMap>(type: T) => (action$: Observable<AnyAction>, state$: StateObservable<RootState>) =>
  action$.pipe(
    Ob.filter(startJob.match),
    Ob.map(a => a.payload),
    Ob.filter(p => p.type === type),
    Ob.map(p =>
      pipe(state$.value.generator.jobs,
        RA.findFirst(j => j.id === p.jobId),
        O.map(x => x as Job<T>))))

export const epics : ReadonlyArray<Epic<AnyAction, AnyAction, RootState>> = [
  flow(withJobType("GenerateDeals"),
    ObO.fold(() => EMPTY, job => generateDeals(job.id, job.details.context.generationId, job.details.parameter))),
  flow(withJobType("Satisfies"),
    ObO.fold(() => EMPTY, job => generateSatisfies(job.id, job.details.context.generationId, job.details.parameter))),
  flow(withJobType("Solve"),
    ObO.fold(() => EMPTY, job => generateSolutions(job.id, job.details.context.generationId, job.details.parameter)))
]