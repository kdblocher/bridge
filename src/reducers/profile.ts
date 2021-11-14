import { option as O, readonlyArray as RA, readonlyRecord as RR, readonlyTuple, semigroup, taskEither } from 'fp-ts';
import { observable as Ob, observableEither } from 'fp-ts-rxjs';
import { flow, pipe } from 'fp-ts/lib/function';
import { castDraft } from 'immer';
import memoize from 'proxy-memoize';
import { Epic } from 'redux-observable';
import { concatWith, EMPTY, from, of } from 'rxjs';

import { AnyAction, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { RootState } from '../app/store';
import { Analysis, AnalysisId, Job, zeroAnalysis, zeroGeneration } from '../model/job';
import { Paths } from '../model/system';
import { ConstrainedBid } from '../model/system/core';
import { deleteByGenerationId } from '../services/idb';
import { DoubleDummyResult } from '../workers/dds.worker';
import { completeJob, removeJob } from './generator';

interface State {
  analyses: RR.ReadonlyRecord<AnalysisId, Analysis>
  selectedAnalysis: O.Option<AnalysisId>
}
const initialState: State = {
  analyses: {},
  selectedAnalysis: O.none
}

const name = 'profile'

const slice = createSlice({
  name,
  initialState,
  reducers: {
    addAnalysis: (state, action: PayloadAction<Paths<ConstrainedBid>>) => {
      const analysis = pipe(action.payload, zeroAnalysis, castDraft)
      state.analyses[analysis.id] = analysis
    },
    deleteAnalysis: (state, action: PayloadAction<AnalysisId>) => { },
    removeAnalysis: (state, action: PayloadAction<AnalysisId>) => {
      delete state.analyses[action.payload]
    },
    selectAnalysis: (state, action: PayloadAction<AnalysisId>) => {
      state.selectedAnalysis = pipe(RR.has(action.payload, state.analyses) ? O.some(action.payload) : O.none)
    },
    setAnalysisName: {
      reducer: (state, action: PayloadAction<string, string, AnalysisId>) => {
        state.analyses[action.meta].name = action.payload
      },
      prepare: (id: AnalysisId, name: string) => ({ payload: name, meta: id })
    },
    addJobToAnalysis: (state, action: PayloadAction<Job>) => {
      const jobType = action.payload.type
      pipe(state.analyses,
        RR.lookup(action.payload.analysisId),
        O.map(analysis => {
          switch (jobType.type) {
            case "GenerateDeals":
              return pipe(jobType.progress,
                O.map(p => analysis.generations.push(pipe(zeroGeneration(jobType.context.generationId, p.value), castDraft))))
            case "Satisfies":
              return pipe(O.Do,
                O.apS('progress', jobType.progress),
                O.apS('generation', pipe(analysis.generations, RA.findFirst(g => g.id === jobType.context.generationId))),
                O.map(o => o.generation.satisfies = O.some(o.progress.value)))
            case "Solve":
              return pipe(O.Do,
                O.apS('progress', jobType.progress),
                O.apS('generation', pipe(analysis.generations, RA.findFirst(g => g.id === jobType.context.generationId))),
                O.map(o => o.generation.solutions = pipe(o.generation.solutions,
                  RR.union(RR.getUnionSemigroup(semigroup.first<DoubleDummyResult>()))({ [jobType.context.bidPath]: o.progress.value }),
                  castDraft)))
          }
        }))
    }
  }
})

export const { addAnalysis, deleteAnalysis, selectAnalysis, setAnalysisName, addJobToAnalysis } = slice.actions
export default slice.reducer

export const epics : ReadonlyArray<Epic<AnyAction, AnyAction, RootState>> = [
  (action$, state$) =>
    action$.pipe(
      Ob.filter(completeJob.match),
      Ob.filter(a => O.isNone(a.error)),
      Ob.chain(flow(a => a.meta, jobId =>
        pipe(state$.value.generator.completed,
          RA.findFirst(j => j.id === jobId),
          O.fold(
            () => EMPTY,
            j => from([addJobToAnalysis(j), removeJob(jobId)])))))),
  (action$, state$) =>
    action$.pipe(
      Ob.filter(deleteAnalysis.match),
      Ob.map(a => a.payload),
      Ob.chain(analysisId =>
        pipe(state$.value.profile.analyses, RR.lookup(analysisId),
          O.fold(() => EMPTY, a =>
            pipe(a.generations, RA.map(g => g.id), taskEither.traverseArray(deleteByGenerationId), Ob.fromTask)),
          observableEither.fold(() => EMPTY, x => EMPTY),
          concatWith(of(slice.actions.removeAnalysis(analysisId))))))
]

export const selectAllAnalyses = memoize((state: State) => 
  pipe(state.analyses,
    RR.toReadonlyArray,
    RA.map(readonlyTuple.snd)))

export const selectSelectedAnalysis = memoize((state: State) => 
  pipe(state.selectedAnalysis,
    O.chain(id => RR.lookup(id, state.analyses))))