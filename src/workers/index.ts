/* eslint-disable import/no-webpack-loader-syntax */

import DDSWorker from 'comlink-loader!./dds.worker'; // inline loader
import DealWorker from 'comlink-loader!./deal.worker'; // inline loader
import SATWorker from 'comlink-loader!./sat.worker';
import SatisfiesWorker from 'comlink-loader!./satisfies.worker';
import { either as E, readonlyArray as RA, readonlyNonEmptyArray as RNEA, taskEither } from 'fp-ts';
import { observable as Ob, observableEither as ObE } from 'fp-ts-rxjs';
import { pipe } from 'fp-ts/lib/function';
import { from, groupBy, Observable } from 'rxjs';

import { get } from '../lib/object';
import pool from '../lib/pool';
import { Bid, makeBoard } from '../model/bridge';
import { GenerationId, Solution } from '../model/job';
import { SerializedBidPath, serializedBidPathL, serializedBoardL, SerializedDeal, serializedDealL } from '../model/serialization';
import { Forest, getAllLeafPaths, Path, Paths } from '../model/system';
import { ConstrainedBid } from '../model/system/core';
import { getBatchIdsByGenerationId } from '../services/idb';

const BATCH_SIZE = 500
export const observeDeals = (generationId: GenerationId) => (count: number) =>
  pipe(
    RA.replicate(count / BATCH_SIZE, BATCH_SIZE),
    RA.append(count % BATCH_SIZE),
    pool(() => new DealWorker(), w => b => w.genDeals(b, generationId)))

export interface SatisfiesBatchResult {
  satisfiesCount: number
  testedCount: number
}
export interface SatisfiesResult extends SatisfiesBatchResult {
  path: SerializedBidPath
}
export const observeSatisfies = (generationId: GenerationId) => (paths: Paths<ConstrainedBid>) =>
  pipe(generationId,
    getBatchIdsByGenerationId,
    ObE.fromTaskEither,
    ObE.chain(x => ObE.fromObservable(from(x))),
    ObE.bindTo('batchId'),
    ObE.bind('path', () => ObE.fromObservable(from(paths))),
    groupBy(E.isRight),
    Ob.chain(group =>
      group.key
      ? pipe(group, Ob.map(r => r.right),
          pool(() => new SatisfiesWorker(), w => ({ batchId, path }) =>
            pipe(
              () => w.satisfiesBatch(path, batchId, generationId),
              taskEither.map((result): SatisfiesResult => ({ ...result,
                path: pipe(path, RNEA.map(cb => cb.bid), serializedBidPathL.get),
              })))
            ()))
      : group))

export const observeSolutions = (deals: ReadonlyArray<SerializedDeal>) =>
  pipe(deals,
    RA.mapWithIndex((i, d) => pipe(d,
      serializedDealL.reverseGet,
      makeBoard(i),
      serializedBoardL.get)),
    pool(() => new DDSWorker(), w => b => w.getResult(b)),
    ObE.bimap(() => "", (x): Solution => ({
      [x.board.deal.id]: x
    })))

export const observeValidation = (forest: Forest<ConstrainedBid>) : Observable<readonly [SerializedBidPath, E.Either<Path<Bid>, void>]> =>
  pipe(forest,
    getAllLeafPaths,
    pool(() => new SATWorker(), w => async p =>
      pipe(await w.getPathIsSound(p),
        result => [pipe(p, RNEA.map(get('bid')), serializedBidPathL.get), result] as const)))