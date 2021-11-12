import { magma, number, option as O, readonlyArray, readonlyRecord as RR } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import objectHash from 'object-hash';
import { UuidTool } from 'uuid-tool';

import { SatisfiesResult } from '../workers';
import { DoubleDummyResult } from '../workers/dds.worker';
import { SerializedBidPath, SerializedBoard } from './serialization';
import { Forest, Paths } from './system';
import { ConstrainedBid } from './system/core';

interface ProgressData<T> {
  unitsDone: number
  updateDate: O.Option<Date>
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
    updateDate: O.some(new Date()),
    value: M.concat(p.value, value)
  })))

export type GenerationId = string
export type Satisfies = RR.ReadonlyRecord<SerializedBidPath, number>
export type Solutions = RR.ReadonlyRecord<SerializedBidPath, number>
export interface Generation {
  id: GenerationId
  dealCount: number
  satisfies: Satisfies
  solutions: Solutions
}
export const zeroGeneration = () : Generation => ({
  id: UuidTool.newUuid(),
  dealCount: 0,
  satisfies: {},
  solutions: {},
})
const magmaGeneration : magma.Magma<Generation> = {
  concat: (g1, g2) => ({ ...g1, dealCount: g1.dealCount + g2.dealCount })
}

export interface Collection {
  id: CollectionId
  systemHash: string
  generations: RR.ReadonlyRecord<GenerationId, Generation>
}
export const zeroCollection = (system: Forest<ConstrainedBid>) : Collection => ({
  id: UuidTool.newUuid(),
  systemHash: objectHash.sha1(system),
  generations: {}
})

export interface JobTypeGenerateDeals {
  type: "GenerateDeals",
  parameter: number
  progress: Progress<Generation>
}
export const updateGenerateDealsProgress = (deals: ReadonlyArray<any>) =>
  updateProgress
    (magmaGeneration)
    (deals.length)
    ({ ...zeroGeneration(), dealCount: deals.length })

export interface JobTypeSatisfies {
  type: "Satisfies",
  parameter: Paths<ConstrainedBid>
  progress: Progress<Satisfies>
}
export const updateSatisfiesProgress = (result: SatisfiesResult) =>
  updateProgress
    (RR.getUnionSemigroup(number.MonoidSum))
    (-1)
    ({ [result.path]: result.count })

export interface JobTypeSolve {
  type: "Solve",
  parameter: ReadonlyArray<SerializedBoard>
  progress: Progress<ReadonlyArray<DoubleDummyResult>>
}
export const updateSolvedProgress = (solutions: ReadonlyArray<DoubleDummyResult>) =>
  updateProgress
    (readonlyArray.getSemigroup<DoubleDummyResult>())
    (solutions.length)
    (solutions)

export type JobType =
  | JobTypeGenerateDeals
  | JobTypeSatisfies
  | JobTypeSolve

export type JobId = string
export type CollectionId = string
export interface Job {
  id: JobId
  collectionId: CollectionId
  dependsOn: ReadonlyArray<JobId>
  type: JobType
  unitsInitial: number
  startDate: O.Option<Date>
  completedDate: O.Option<Date>
  running: boolean
  error: O.Option<string>
}
export const zeroJob = (collectionId: CollectionId, estimatedUnitsInitial: number, type: JobType): Job => ({
  id: UuidTool.newUuid(),
  collectionId,
  dependsOn: [],
  type,
  unitsInitial: estimatedUnitsInitial,
  startDate: O.none,
  completedDate: O.none,
  running: false,
  error: O.none
})