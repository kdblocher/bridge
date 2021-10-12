/* eslint-disable import/no-webpack-loader-syntax */

import { readonlyArray, task } from 'fp-ts';

import DDSWorker from 'comlink-loader!./dds.worker'; // inline loader
import DealWorker from 'comlink-loader!./deal.worker'; // inline loader
import { SerializedBoard } from '../model/serialization';
import { pipe } from 'fp-ts/lib/function';

export const makeGenDealsTask = (count: number) => () => new DealWorker().genDeals(count)
export const makeGetResultsTask = (boards: ReadonlyArray<SerializedBoard>) =>
  pipe(task.Do,
    task.chain(() => {
      const w = new DDSWorker()
      return pipe(boards,
        readonlyArray.mapWithIndex((i, b) => pipe(() => w.getResult(b),
          task.chainFirstIOK(r => () => console.log(i))
        )),
        task.sequenceArray)
    }))