import {
  option as O,
  readonlyArray as RA,
  readonlyNonEmptyArray as RNEA,
  readonlyRecord as RR,
  readonlyTuple as RT,
  taskEither as TE,
} from "fp-ts";
import { observable as Ob, observableEither } from "fp-ts-rxjs";
import { flow, pipe } from "fp-ts/lib/function";
import { castDraft } from "immer";
import memoize from "proxy-memoize";
import { Epic } from "redux-observable";
import { concatWith, EMPTY, from, of } from "rxjs";
import { WritableDraft } from "immer/dist/internal";

import { AnyAction, createSlice, PayloadAction } from "@reduxjs/toolkit";

import { RootState } from "../app/store";
import { assertUnreachable } from "../lib";
import { get } from "../lib/object";
import {
  Analysis,
  AnalysisId,
  GenerationId,
  Job,
  JobDetailsMap,
  JobTypeGenerateDeals,
  newGenerationId,
  zeroAnalysis,
  zeroGeneration,
} from "../model/job";
import { getStats } from "../model/stats";
import { Paths } from "../model/system";
import { ConstrainedBid } from "../model/system/core";
import { deleteByGenerationId } from "../services/idb";
import { completeJob, removeJob, scheduleJob, startJob } from "./generator";

interface State {
  analyses: RR.ReadonlyRecord<AnalysisId, Analysis>;
  selectedAnalysis: O.Option<AnalysisId>;
}
const initialState: State = {
  analyses: {},
  selectedAnalysis: O.none,
};

const name = "profile";

const slice = createSlice({
  name,
  initialState,
  reducers: {
    addAnalysis: (
      state,
      action: PayloadAction<{
        id: AnalysisId;
        name: string;
        count: number;
        paths: Paths<ConstrainedBid>;
      }>
    ) => {
      const analysis = pipe(
        action.payload,
        ({ id, name, count, paths }) => zeroAnalysis(id, name, paths),
        castDraft
      );
      state.analyses[analysis.id] = analysis;
    },
    deleteAnalysis: (state, action: PayloadAction<AnalysisId>) => {},
    removeAnalysis: (state, action: PayloadAction<AnalysisId>) => {
      delete state.analyses[action.payload];
    },
    selectAnalysis: (state, action: PayloadAction<AnalysisId>) => {
      state.selectedAnalysis = pipe(
        RR.has(action.payload, state.analyses) ? O.some(action.payload) : O.none
      );
    },
    setAnalysisName: {
      reducer: (state, action: PayloadAction<string, string, AnalysisId>) => {
        state.analyses[action.meta].name = action.payload;
      },
      prepare: (id: AnalysisId, name: string) => ({ payload: name, meta: id }),
    },
    addJobToAnalysis: <K extends keyof JobDetailsMap>(
      state: WritableDraft<State>,
      action: PayloadAction<Job<K>>
    ) => {
      pipe(
        state.analyses,
        RR.lookup(action.payload.analysisId),
        O.map((analysis) => {
          switch (action.payload.type) {
            case "GenerateDeals":
              const genJob = action.payload as Job<"GenerateDeals">;
              return pipe(
                genJob.details.progress,
                O.map((p) =>
                  analysis.generations.push(
                    pipe(
                      zeroGeneration(
                        genJob.details.context.generationId,
                        p.value
                      ),
                      castDraft
                    )
                  )
                )
              );
            case "Satisfies":
              const satJob = action.payload as Job<"Satisfies">;
              return pipe(
                O.Do,
                O.apS("progress", satJob.details.progress),
                O.apS(
                  "generation",
                  pipe(
                    analysis.generations,
                    RA.findFirst(
                      (g) => g.id === satJob.details.context.generationId
                    )
                  )
                ),
                O.map(
                  (o) => (o.generation.satisfies = O.some(o.progress.value))
                )
              );
            case "Solve":
              const solveJob = action.payload as Job<"Solve">;
              return pipe(
                O.Do,
                O.apS("progress", solveJob.details.progress),
                O.apS(
                  "generation",
                  pipe(
                    analysis.generations,
                    RA.findFirst(
                      (g) => g.id === solveJob.details.context.generationId
                    )
                  )
                ),
                O.map((o) =>
                  pipe(
                    o.progress.value,
                    RR.toReadonlyArray,
                    RNEA.fromReadonlyArray,
                    O.map(
                      flow(
                        RNEA.map(flow(RT.snd, get("results"))),
                        getStats,
                        (stats) => {
                          if (
                            RR.has(
                              solveJob.details.context.bidPath,
                              o.generation.solutionStats
                            )
                          ) {
                            throw new Error(
                              "Combining stat result sets is not implemented"
                            );
                          }
                          o.generation.solutionStats[
                            solveJob.details.context.bidPath
                          ] = stats;
                        }
                      )
                    )
                  )
                )
              );
            default:
              return assertUnreachable(action.payload.type);
          }
        })
      );
    },
  },
});

export const {
  addAnalysis,
  deleteAnalysis,
  selectAnalysis,
  setAnalysisName,
  addJobToAnalysis,
} = slice.actions;
export default slice.reducer;

export const epics: ReadonlyArray<Epic<AnyAction, AnyAction, RootState>> = [
  (action$, state$) =>
    action$.pipe(
      Ob.filter(addAnalysis.match),
      Ob.chain(
        flow(
          (a) => a.payload,
          ({ id, count }) =>
            pipe(
              state$.value.profile.analyses,
              RR.keys,
              RA.filter((id2) => id2 !== id),
              RA.map(deleteAnalysis),
              (analyses) =>
                from([
                  ...analyses,
                  selectAnalysis(id),
                  scheduleJob({
                    analysisId: id,
                    type: "GenerateDeals",
                    context: { generationId: newGenerationId() },
                    parameter: count,
                    estimatedUnitsInitial: count,
                  }),
                ])
            )
        )
      )
    ),
  (action$, state$) =>
    action$.pipe(
      Ob.filter(addJobToAnalysis.match),
      Ob.filterMap((a) =>
        pipe(
          O.Do,
          O.bind("job", () =>
            a.payload.type === "GenerateDeals"
              ? O.some(a.payload as Job & { details: JobTypeGenerateDeals })
              : O.none
          ),
          O.bind("analysis", ({ job }) =>
            selectAnalysisById({
              state: state$.value.profile,
              analysisId: job.analysisId,
            })
          )
        )
      ),
      Ob.chain(({ job, analysis }) =>
        of(
          scheduleJob({
            analysisId: job.analysisId,
            type: "Satisfies",
            parameter: analysis.paths,
            context: job.details.context,
            estimatedUnitsInitial:
              analysis.paths.length * job.details.parameter,
          })
        )
      )
    ),
  (action$, state$) =>
    action$.pipe(
      Ob.filter(completeJob.match),
      Ob.filter((a) => O.isNone(a.error)),
      Ob.chain(
        flow(
          (a) => a.meta,
          (jobId) =>
            pipe(
              state$.value.generator.completed,
              RA.findFirst((j) => j.id === jobId),
              O.fold(
                () => EMPTY,
                (j) => from([addJobToAnalysis(j), removeJob(jobId)])
              )
            )
        )
      )
    ),
  (action$, state$) =>
    state$.pipe(
      Ob.map((s) =>
        pipe(
          s.generator.jobs,
          RA.filter((j) => O.isNone(j.startDate))
        )
      ),
      Ob.filterMap(RNEA.fromReadonlyArray),
      Ob.chain(
        flow(
          RA.map((j) => startJob({ jobId: j.id, type: j.type })),
          from
        )
      )
    ),
  (action$, state$) =>
    action$.pipe(
      Ob.filter(deleteAnalysis.match),
      Ob.map((a) => a.payload),
      Ob.chain((analysisId) =>
        pipe(
          state$.value.profile.analyses,
          RR.lookup(analysisId),
          O.fold(
            () => EMPTY,
            (a) =>
              pipe(
                a.generations,
                RA.map((g) => g.id),
                TE.traverseArray(deleteByGenerationId),
                Ob.fromTask
              )
          ),
          observableEither.fold(
            () => EMPTY,
            (x) => EMPTY
          ),
          concatWith(of(slice.actions.removeAnalysis(analysisId)))
        )
      )
    ),
];

export const selectAllAnalyses = memoize((state: State) =>
  pipe(state.analyses, RR.toReadonlyArray, RA.map(RT.snd))
);

export const selectSelectedAnalysis = memoize((state: State) =>
  pipe(
    state.selectedAnalysis,
    O.chain((id) => RR.lookup(id, state.analyses))
  )
);

interface AnalysisIndex {
  state: State;
  analysisId: AnalysisId;
}
export const selectAnalysisById = memoize((idx: AnalysisIndex) =>
  pipe(idx.state.analyses, RR.lookup(idx.analysisId))
);

interface GenerationIndex extends AnalysisIndex {
  generationId: GenerationId;
}
export const selectGenerationByAnalysis = memoize((idx: GenerationIndex) =>
  pipe(
    selectAnalysisById(idx),
    O.chain(
      flow(
        get("generations"),
        RA.findFirst((g) => g.id === idx.generationId)
      )
    )
  )
);
