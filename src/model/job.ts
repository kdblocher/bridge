import { either, magma, number, option as O, readonlyArray, readonlyRecord as RR } from 'fp-ts';
import { Right } from 'fp-ts/lib/Either';
import { Lazy, pipe } from 'fp-ts/lib/function';
import * as t from 'io-ts';
import { UuidTool } from 'uuid-tool';

import { assertUnreachable } from '../lib';
import { SatisfiesResult } from '../workers';
import { DoubleDummyResult } from '../workers/dds.worker';
import { SerializedBidPath, SerializedBoard } from './serialization';
import { Paths } from './system';
import { ConstrainedBid } from './system/core';

export const DateNumberB = t.brand(t.number, (d): d is t.Branded<number, { readonly Date: unique symbol }> => d <= new Date().getTime(), "Date")
export type DateNumber = t.TypeOf<typeof DateNumberB>
export const now : Lazy<DateNumber> = () => pipe(new Date().getTime(), DateNumberB.decode, x => (x as either.Right<DateNumber>).right)

interface ProgressData<T> {
  unitsDone: number
  updateDate: O.Option<DateNumber>
  value: T
}
type Progress<T> = O.Option<ProgressData<T>>
export const initProgress = <T>(value: T): Progress<T> => O.some({
  unitsDone: 0,
  updateDate: O.none,
  value
})

export const updateProgress = <T>(M: magma.Magma<T>) => (unitsDone: number) => (value: T) => (progress: Progress<T>): Progress<T> =>
  pipe(progress, O.map(p => ({
    unitsDone: p.unitsDone + unitsDone,
    updateDate: O.some(now()),
    value: M.concat(p.value, value)
  })))

export const GenerationIdB = t.brand(t.string, (id): id is t.Branded<string, { readonly GenerationId: unique symbol }> => UuidTool.isUuid(id), "GenerationId")
export type GenerationId = t.TypeOf<typeof GenerationIdB>
export const newGenerationId = () => (GenerationIdB.decode(UuidTool.newUuid()) as Right<GenerationId>).right

export type Satisfies = RR.ReadonlyRecord<SerializedBidPath, number>
export type Solutions = RR.ReadonlyRecord<SerializedBidPath, ReadonlyArray<DoubleDummyResult>>
export interface Generation {
  id: GenerationId
  dealCount: number
  satisfies: O.Option<Satisfies>
  solutions: Solutions
}
export const zeroGeneration = (id: GenerationId, dealCount: number) : Generation => ({
  id,
  dealCount,
  satisfies: O.none,
  solutions: {},
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
    (-1)
    ({ [result.path]: result.count })

export interface JobTypeSolve {
  type: "Solve",
  parameter: ReadonlyArray<SerializedBoard>
  context: { generationId: GenerationId, bidPath: SerializedBidPath }
  progress: Progress<ReadonlyArray<DoubleDummyResult>>
}
const zeroSolveProgress = () => initProgress<ReadonlyArray<DoubleDummyResult>>([])
export const updateSolveProgress = (solutions: ReadonlyArray<DoubleDummyResult>) =>
  updateProgress
    (readonlyArray.getSemigroup<DoubleDummyResult>())
    (solutions.length)
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