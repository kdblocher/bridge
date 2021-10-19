/* eslint-disable import/no-webpack-loader-syntax */

import DDSWorker from 'comlink-loader!./dds.worker'; // inline loader
import DealWorker from 'comlink-loader!./deal.worker'; // inline loader
import { readonlyArray, readonlyNonEmptyArray } from 'fp-ts';
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
    const perWorker = Math.floor(count / concurrency)
    const remainder = Math.floor(count % concurrency)
    return idx => observeDealsSerial(idx === 0
      ? perWorker + remainder
      : perWorker)
  })

export const observeResultsSerial = (boards: ReadonlyArray<SerializedBoard>): Observable<DoubleDummyResult> => {
  const w = new DDSWorker()
  return pipe(from(boards),
    observable.chain(board => from(w.getResult(board))))
}

export const observeResultsParallel = (boards: readonlyNonEmptyArray.ReadonlyNonEmptyArray<SerializedBoard>) =>
  parallelize(concurrency => {
    const perWorker = Math.floor(boards.length / concurrency)
    const remainder = Math.floor(boards.length % concurrency)
    return idx => observeResultsSerial(idx === concurrency - 1
      ? pipe(boards, readonlyArray.takeRight(perWorker + remainder))
      : pipe(boards.slice(idx * perWorker, (idx + 1) * perWorker)))
    })