/* eslint-disable import/no-webpack-loader-syntax */

import DDSWorker from 'comlink-loader!./dds.worker'; // inline loader
import DealWorker from 'comlink-loader!./deal.worker'; // inline loader
import SatisfiesWorker from 'comlink-loader!./satisfies.worker';
import { either, readonlyArray, readonlyNonEmptyArray, taskEither } from 'fp-ts';
import { observable as Ob, observableEither as ObE } from 'fp-ts-rxjs';
import { pipe } from 'fp-ts/lib/function';
import { from, groupBy } from 'rxjs';

import pool from '../lib/pool';
import { GenerationId } from '../model/job';
import { SerializedBidPath, serializedBidPathL, SerializedBoard } from '../model/serialization';
import { Paths } from '../model/system';
import { ConstrainedBid } from '../model/system/core';
import { getBatchIdsByGenerationId } from '../services/idb';

const BATCH_SIZE = 500
export const observeDeals = (count: number, generationId: GenerationId) =>
  pipe(
    readonlyArray.replicate(count / BATCH_SIZE, BATCH_SIZE),
    readonlyArray.append(count % BATCH_SIZE),
    pool(() => new DealWorker(), w => b => w.genDeals(b, generationId)))

export interface SatisfiesBatchResult {
  satisfiesCount: number
  testedCount: number
}
export interface SatisfiesResult extends SatisfiesBatchResult {
  path: SerializedBidPath
}
export const observeSatisfies = (paths: Paths<ConstrainedBid>) => (generationId: GenerationId) =>
  pipe(generationId,
    getBatchIdsByGenerationId,
    ObE.fromTaskEither,
    ObE.chain(x => ObE.fromObservable(from(x))),
    ObE.bindTo('batchId'),
    ObE.bind('path', () => ObE.fromObservable(from(paths))),
    groupBy(either.isRight),
    Ob.chain(group =>
      group.key
      ? pipe(group, Ob.map(r => r.right),
          pool(() => new SatisfiesWorker(), w => ({ batchId, path }) =>
            pipe(
              () => w.satisfiesBatch(path, batchId, generationId),
              taskEither.map((result): SatisfiesResult => ({ ...result,
                path: pipe(path, readonlyNonEmptyArray.map(cb => cb.bid), serializedBidPathL.get),
              })))
            ()))
      : group))

export const observeSolutions = (boards: ReadonlyArray<SerializedBoard>) =>
  pipe(boards,
    pool(() => new DDSWorker(), w => b => w.getResult(b)),
    ObE.fromObservable,
    ObE.bimap(() => "", readonlyArray.of))