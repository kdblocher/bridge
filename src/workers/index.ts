/* eslint-disable import/no-webpack-loader-syntax */

import DDSWorker from 'comlink-loader!./dds.worker'; // inline loader
import DealWorker from 'comlink-loader!./deal.worker'; // inline loader
import { observable } from 'fp-ts-rxjs';
import { pipe } from 'fp-ts/lib/function';
import { from, Observable, repeat, take } from 'rxjs';
import { parallelize } from '../lib/concurrency';
import { SerializedBoard } from '../model/serialization';
import { DoubleDummyResult } from './dds.worker';


const observeBatchedDealsInfinite = (batchSize: number) => {
  const w = new DealWorker()
  return pipe(() => w.genDeals(batchSize),
    observable.fromTask).pipe(
      repeat())
}

export const observeDealsSerial = (count: number) => pipe(
  observeBatchedDealsInfinite(Math.ceil(Math.log(count))),
  observable.chain(x => from(x))).pipe(
    take(count))

export const observeDealsParallel = (count: number) =>
  parallelize(concurrency => {
    const handsPerWorker = Math.floor(count / concurrency)
    const remainder = Math.floor(count % concurrency)
    return idx => observeDealsSerial(idx === 0 ? handsPerWorker + remainder : handsPerWorker)
  })

export const observeResultsSerial = (boards: Observable<SerializedBoard>): Observable<DoubleDummyResult> => {
  const w = new DDSWorker()
  return pipe(boards,
    observable.chain(board => from(w.getResult(board))))
}

export const observeResultsParallel = (boards: Observable<SerializedBoard>) =>
  parallelize(_ => _ => observeResultsSerial(boards))