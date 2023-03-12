import {
  either,
  magma,
  number,
  option as O,
  readonlyRecord as RR,
  semigroup,
} from "fp-ts";
import { Right } from "fp-ts/lib/Either";
import { Lazy, pipe } from "fp-ts/lib/function";
import * as t from "io-ts";
import objectHash from "object-hash";
import { UuidTool } from "uuid-tool";

import { assertUnreachable } from "../lib";
import { get } from "../lib/object";
import { SatisfiesResult } from "../workers";
import { DoubleDummyResult } from "../workers/dds.worker";
import { SerializedBidPath, SerializedDeal } from "./serialization";
import { Stats } from "./stats";
import { Path, Paths } from "./system";
import { ConstrainedBid } from "./system/core";

export const DateNumberB = t.brand(
  t.number,
  (d): d is t.Branded<number, { readonly Date: unique symbol }> => true,
  "Date"
);
export type DateNumber = t.TypeOf<typeof DateNumberB>;
export const now: Lazy<DateNumber> = () =>
  pipe(
    new Date().getTime(),
    DateNumberB.decode,
    (x) => (x as either.Right<DateNumber>).right
  );

const timeSpanC = t.tuple([DateNumberB, DateNumberB]);
export type TimeSpan = t.TypeOf<typeof timeSpanC>;

export interface ProgressData {
  unitsDone: number;
  updateDate: O.Option<DateNumber>;
  speed: O.Option<number>;
}
interface ProgressDataWithValue<T> extends ProgressData {
  value: T;
}
type Progress<T> = O.Option<ProgressDataWithValue<T>>;

export const getGenericProgress = (job: Job) =>
  job.details.progress as O.Option<ProgressData>;

export const initProgress = <T>(value: T): Progress<T> =>
  O.some({
    unitsDone: 0,
    updateDate: O.none,
    speed: O.none,
    value,
  });

const SMOOTHING_FACTOR = 0.1;
export const updateProgress =
  <T>(M: magma.Magma<T>) =>
  (unitsDone: number) =>
  (value: T) =>
  (progress: Progress<T>): Progress<T> =>
    pipe(
      progress,
      O.map((p) => {
        const updateDate = now();
        const speed = pipe(
          p.updateDate,
          O.map((lastUpdate) => (updateDate - lastUpdate) / unitsDone),
          O.filter((x) => !isNaN(x) && isFinite(x))
        );
        return {
          unitsDone: p.unitsDone + unitsDone,
          updateDate: O.some(updateDate),
          value: M.concat(p.value, value),
          speed: pipe(
            O.Do,
            O.apS("avg", p.speed),
            O.apS("next", speed),
            O.map(
              (o) => (1 - SMOOTHING_FACTOR) * o.avg + SMOOTHING_FACTOR * o.next
            ),
            O.filter((x) => !isNaN(x) && isFinite(x)),
            O.alt(() => speed),
            O.alt(() => p.speed)
          ),
        };
      })
    );

export const GenerationIdB = t.brand(
  t.string,
  (id): id is t.Branded<string, { readonly GenerationId: unique symbol }> =>
    UuidTool.isUuid(id),
  "GenerationId"
);
export type GenerationId = t.TypeOf<typeof GenerationIdB>;
export const newGenerationId = () =>
  (GenerationIdB.decode(UuidTool.newUuid()) as Right<GenerationId>).right;

export type Satisfies = RR.ReadonlyRecord<SerializedBidPath, number>;
export interface Generation {
  id: GenerationId;
  dealCount: number;
  satisfies: O.Option<Satisfies>;
  solutionStats: RR.ReadonlyRecord<SerializedBidPath, Stats>;
}
export const zeroGeneration = (
  id: GenerationId,
  dealCount: number
): Generation => ({
  id,
  dealCount,
  satisfies: O.none,
  solutionStats: {},
});

export const AnalysisIdB = t.brand(
  t.string,
  (id): id is t.Branded<string, { readonly AnalysisId: unique symbol }> =>
    UuidTool.isUuid(id),
  "AnalysisId"
);
export type AnalysisId = t.TypeOf<typeof AnalysisIdB>;
export const newAnalysisId = () =>
  (AnalysisIdB.decode(UuidTool.newUuid()) as Right<AnalysisId>).right;
export interface Analysis {
  id: AnalysisId;
  name: string;
  paths: Paths<ConstrainedBid>;
  generations: ReadonlyArray<Generation>;
}

export const zeroAnalysis = (
  id: AnalysisId,
  name: string,
  paths: Paths<ConstrainedBid>
): Analysis => ({
  id,
  name,
  paths,
  generations: [],
});

export interface JobTypeGenerateDeals {
  parameter: number
  context: { generationId: GenerationId }
  progress: Progress<number>
}
export interface JobTypeSatisfies {
  parameter: Paths<ConstrainedBid>
  context: { generationId: GenerationId }
  progress: Progress<Satisfies>
}
export interface JobTypeSolve {
  parameter: ReadonlyArray<SerializedDeal>
  context: { generationId: GenerationId; bidPath: SerializedBidPath }
  progress: Progress<Solution>
}
export type JobDetailsMap = {
  "GenerateDeals": JobTypeGenerateDeals
  "Satisfies": JobTypeSatisfies
  "Solve": JobTypeSolve
}
export type Job<K extends keyof JobDetailsMap = keyof JobDetailsMap> = { [P in K]: {
  id: JobId
  analysisId: AnalysisId
  dependsOn: ReadonlyArray<JobId>
  unitsInitial: number
  startDate: O.Option<DateNumber>
  completedDate: O.Option<DateNumber>
  running: boolean
  error: O.Option<string>
  type: P
  details: JobDetailsMap[P]
}}[K];

const zeroGenerateDealsProgress = () => initProgress(0);
export const updateGenerateDealsProgress = (deals: ReadonlyArray<any>) =>
  updateProgress(number.MonoidSum)(deals.length)(deals.length);

const ConstrainedBidPathHashC = t.brand(
  t.string,
  (hash): hash is t.Branded<string, { readonly PathHash: unique symbol }> =>
    true,
  "PathHash"
);
export type ConstrainedBidPathHash = t.TypeOf<typeof ConstrainedBidPathHashC>;
export const getBidPathHash = (cb: Path<ConstrainedBid>) =>
  (
    ConstrainedBidPathHashC.decode(
      objectHash(cb)
    ) as Right<ConstrainedBidPathHash>
  ).right;

const zeroSatisfiesProgress = () => initProgress<Satisfies>({});
export const updateSatisfiesProgress = (result: SatisfiesResult) =>
  updateProgress(RR.getUnionSemigroup(number.MonoidSum))(result.testedCount)({
    [result.path]: result.satisfiesCount,
  });

export type Solution = RR.ReadonlyRecord<
  SerializedDeal["id"],
  DoubleDummyResult
>

const zeroSolveProgress = () => initProgress<Solution>({});
export const updateSolveProgress = (solutions: Solution) =>
  updateProgress(RR.getUnionSemigroup(semigroup.first<DoubleDummyResult>()))(
    pipe(solutions, RR.keys, (keys) => keys.length)
  )(solutions);

export const initJobProgress = <K extends keyof JobDetailsMap>(type: K): Job<K>["details"]["progress"] => {
  switch (type) {
    case "GenerateDeals":
      return zeroGenerateDealsProgress();
    case "Satisfies":
      return zeroSatisfiesProgress();
    case "Solve":
      return zeroSolveProgress();
    default:
      return assertUnreachable(type);
  }
};

export const JobIdB = t.brand(
  t.string,
  (id): id is t.Branded<string, { readonly JobId: unique symbol }> =>
    UuidTool.isUuid(id),
  "JobId"
);
export type JobId = t.TypeOf<typeof JobIdB>;
const newJobId = () =>
  (JobIdB.decode(UuidTool.newUuid()) as Right<JobId>).right;

export const zeroJob = <K extends keyof JobDetailsMap>(
  analysisId: AnalysisId,
  estimatedUnitsInitial: number,
  type: K,
  details: JobDetailsMap[K]
): Job<K> => ({
  id: newJobId(),
  analysisId,
  dependsOn: [],
  unitsInitial: estimatedUnitsInitial,
  startDate: O.none,
  completedDate: O.none,
  running: false,
  error: O.none,
  type,
  details,
});

export const unitsRemaining = (job: Job) =>
  pipe(
    job,
    getGenericProgress,
    O.fold(() => 0, get("unitsDone")),
    (done) => job.unitsInitial - done
  );

export const percentageRemaining = (job: Job) =>
  pipe(
    job,
    getGenericProgress,
    O.fold(() => 0, get("unitsDone")),
    (done) => Math.floor((done * 100) / job.unitsInitial)
  );

export const elapsedTime = (job: Job) =>
  pipe(
    O.Do,
    O.apS("progress", pipe(job, getGenericProgress)),
    O.apS("start", job.startDate),
    O.bind("update", ({ progress }) => progress.updateDate),
    O.map((o): TimeSpan => [o.update, o.start])
  );

export const estimatedTimeRemaining =
  (unitsInitial: number) => (progress: ProgressData) =>
    pipe(
      progress.speed,
      O.map((speed) => speed * (unitsInitial - progress.unitsDone))
    );
