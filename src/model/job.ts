import { either, magma, number, option as O, readonlyRecord as RR, semigroup } from 'fp-ts';
import { Right } from 'fp-ts/lib/Either';
import { Lazy, pipe } from 'fp-ts/lib/function';
import * as t from 'io-ts';
import objectHash from 'object-hash';
import { UuidTool } from 'uuid-tool';

import { assertUnreachable } from '../lib';
import { get } from '../lib/object';
import { SatisfiesResult } from '../workers';
import { DoubleDummyResult } from '../workers/dds.worker';
import { SerializedBidPath, SerializedDeal } from './serialization';
import { Stats } from './stats';
import { Path, Paths } from './system';
import { ConstrainedBid } from './system/core';

export const DateNumberB = t.brand(t.number, (d): d is t.Branded<number, { readonly Date: unique symbol }> => true, "Date")
export type DateNumber = t.TypeOf<typeof DateNumberB>
export const now : Lazy<DateNumber> = () => pipe(new Date().getTime(), DateNumberB.decode, x => (x as either.Right<DateNumber>).right)

const timeSpanC = t.tuple([DateNumberB, DateNumberB])
export type TimeSpan = t.TypeOf<typeof timeSpanC>

interface ProgressData<T> {
  unitsDone: number
  updateDate: DateNumber
  speed: O.Option<number>
  value: T
}
type Progress<T> = O.Option<ProgressData<T>>

export const getGenericProgress = (job: Job) =>
  job.type.progress as Progress<never>

export const initProgress = <T>(value: T): Progress<T> => O.some({
  unitsDone: 0,
  updateDate: now(),
  speed: O.none,
  value
})

const SMOOTHING_FACTOR = 0.1
export const updateProgress = <T>(M: magma.Magma<T>) => (unitsDone: number) => (value: T) => (progress: Progress<T>): Progress<T> =>
  pipe(progress,
    O.map(p => {
      const updateDate = now()
      const speed = (updateDate - p.updateDate) / unitsDone
      return {
        unitsDone: p.unitsDone + unitsDone,
        updateDate,
        value: M.concat(p.value, value),
        speed: pipe(p.speed,
          O.map(avg => (1 - SMOOTHING_FACTOR) * avg + (SMOOTHING_FACTOR) * (
            (updateDate - p.updateDate) / unitsDone)),
          O.alt(() => O.some(speed)))
      }
    }))

export const GenerationIdB = t.brand(t.string, (id): id is t.Branded<string, { readonly GenerationId: unique symbol }> => UuidTool.isUuid(id), "GenerationId")
export type GenerationId = t.TypeOf<typeof GenerationIdB>
export const newGenerationId = () => (GenerationIdB.decode(UuidTool.newUuid()) as Right<GenerationId>).right

export type Satisfies = RR.ReadonlyRecord<SerializedBidPath, number>
export interface Generation {
  id: GenerationId
  dealCount: number
  satisfies: O.Option<Satisfies>
  solutionStats: RR.ReadonlyRecord<SerializedBidPath, Stats>
}
export const zeroGeneration = (id: GenerationId, dealCount: number) : Generation => ({
  id,
  dealCount,
  satisfies: O.none,
  solutionStats: {}
})

export const AnalysisIdB = t.brand(t.string, (id): id is t.Branded<string, { readonly AnalysisId: unique symbol }> => UuidTool.isUuid(id), "AnalysisId")
export type AnalysisId = t.TypeOf<typeof AnalysisIdB>
const newAnalysisId = () => (AnalysisIdB.decode(UuidTool.newUuid()) as Right<AnalysisId>).right
export interface Analysis {
  id: AnalysisId
  name: string
  paths: Paths<ConstrainedBid>
  generations: ReadonlyArray<Generation>
}
export const zeroAnalysis = (paths: Paths<ConstrainedBid>) : Analysis => ({
  id: newAnalysisId(),
  name: `New analysis (${paths.length} paths)`,
  paths,
  generations: []
})

export interface JobTypeGenerateDeals {
  type: "GenerateDeals",
  parameter: number
  context: { generationId: GenerationId }
  progress: Progress<number>
}
const zeroGenerateDealsProgress = () => initProgress(0)
export const updateGenerateDealsProgress = (deals: ReadonlyArray<any>) =>
  updateProgress
    (number.MonoidSum)
    (deals.length)
    (deals.length)

const ConstrainedBidPathHashC = t.brand(t.string, (hash): hash is t.Branded<string, { readonly PathHash: unique symbol }> => true, "PathHash")
export type ConstrainedBidPathHash = t.TypeOf<typeof ConstrainedBidPathHashC>
export const getBidPathHash = (cb: Path<ConstrainedBid>) => (ConstrainedBidPathHashC.decode(objectHash(cb)) as Right<ConstrainedBidPathHash>).right
export interface JobTypeSatisfies {
  type: "Satisfies",
  parameter: Paths<ConstrainedBid>
  context: JobTypeGenerateDeals["context"]
  progress: Progress<Satisfies>
}
const zeroSatisfiesProgress = () => initProgress<Satisfies>({})
export const updateSatisfiesProgress = (result: SatisfiesResult) =>
  updateProgress
    (RR.getUnionSemigroup(number.MonoidSum))
    (result.testedCount)
    ({ [result.path]: result.satisfiesCount })

export type Solution = RR.ReadonlyRecord<SerializedDeal["id"], DoubleDummyResult>
export interface JobTypeSolve {
  type: "Solve",
  parameter: ReadonlyArray<SerializedDeal>
  context: { generationId: GenerationId, bidPath: SerializedBidPath }
  progress: Progress<Solution>
}
const zeroSolveProgress = () => initProgress<Solution>({})
export const updateSolveProgress = (solutions: Solution) =>
  updateProgress
    (RR.getUnionSemigroup(semigroup.first<DoubleDummyResult>()))
    (pipe(solutions, RR.keys, keys => keys.length))
    (solutions)

export type JobType =
  | JobTypeGenerateDeals
  | JobTypeSatisfies
  | JobTypeSolve

export const initJobProgress = (type: JobType["type"]) => {
  switch (type) {
    case "GenerateDeals": return zeroGenerateDealsProgress()
    case "Satisfies": return zeroSatisfiesProgress()
    case "Solve": return zeroSolveProgress()
    default: return assertUnreachable(type)
  }
}

export const JobIdB = t.brand(t.string, (id): id is t.Branded<string, { readonly JobId: unique symbol }> => UuidTool.isUuid(id), "JobId")
export type JobId = t.TypeOf<typeof JobIdB>
const newJobId = () => (JobIdB.decode(UuidTool.newUuid()) as Right<JobId>).right
export interface Job {
  id: JobId
  analysisId: AnalysisId
  dependsOn: ReadonlyArray<JobId>
  type: JobType
  unitsInitial: number
  startDate: O.Option<DateNumber>
  completedDate: O.Option<DateNumber>
  running: boolean
  error: O.Option<string>
}
export const zeroJob = (analysisId: AnalysisId, estimatedUnitsInitial: number, type: JobType): Job => ({
  id: newJobId(),
  analysisId,
  dependsOn: [],
  type,
  unitsInitial: estimatedUnitsInitial,
  startDate: O.none,
  completedDate: O.none,
  running: false,
  error: O.none
})

export const unitsRemaining = (job: Job) =>
  pipe(job,
    getGenericProgress,
    O.fold(() => 0, get('unitsDone')),
    done => job.unitsInitial - done)

export const percentageRemaining = (job: Job) =>
  pipe(job,
    getGenericProgress,
    O.fold(() => 0, get('unitsDone')),
    done => Math.floor(done * 100 / job.unitsInitial))

export const elapsedTime = (job: Job) =>
  pipe(O.Do,
    O.apS('progress', pipe(job, getGenericProgress)),
    O.apS('start', job.startDate),
    O.map((o): TimeSpan => [o.progress.updateDate, o.start]))

export const estimatedTimeRemaining = (job: Job) =>
  pipe(O.Do,
    O.apS('start', job.startDate),
    O.apS('progress', pipe(job, getGenericProgress)),
    O.bind('speed', ({ progress }) => progress.speed),
    O.map(o => o.speed * (job.unitsInitial - o.progress.unitsDone)))