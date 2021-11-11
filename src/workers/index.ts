/* eslint-disable import/no-webpack-loader-syntax */

import DDSWorker from 'comlink-loader!./dds.worker'; // inline loader
import DealWorker from 'comlink-loader!./deal.worker'; // inline loader
import SatisfiesWorker from 'comlink-loader!./satisfies.worker';
import { either, readonlyArray, readonlyNonEmptyArray, separated, taskEither } from 'fp-ts';
import { observable as Ob, observableEither as ObE } from 'fp-ts-rxjs';
import { constVoid, flow, pipe } from 'fp-ts/lib/function';
import { from, groupBy, mergeMap, partition, tap } from 'rxjs';

import pool from '../lib/pool';
import { SerializedBidPath, serializedBidPathL, SerializedBoard } from '../model/serialization';
import { Paths } from '../model/system';
import { ConstrainedBid } from '../model/system/core';
import { getBatchIdsByJobId } from '../services/idb';

const BATCH_SIZE = 100
export const observeDeals = (count: number, jobId?: string) =>
  pipe(
    readonlyArray.replicate(count / BATCH_SIZE, BATCH_SIZE),
    readonlyArray.append(count % BATCH_SIZE),
    pool(() => new DealWorker(), w => b => w.genDeals(b, jobId)))

export interface SatisfiesResult {
  path: SerializedBidPath
  count: number
}
export const observeSatisfies = (paths: Paths<ConstrainedBid>) =>
  flow(
    getBatchIdsByJobId,
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
              () => w.satisfiesBatch(path, batchId),
              taskEither.map((count): SatisfiesResult => ({
                path: pipe(path, readonlyNonEmptyArray.map(cb => cb.bid), serializedBidPathL.get),
                count
              })))
            ()))
      : group))

export const observeResults = (boards: ReadonlyArray<SerializedBoard>) =>
  pipe(boards,
    pool(() => new DDSWorker(), w => b => w.getResult(b)))