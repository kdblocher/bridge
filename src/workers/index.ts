/* eslint-disable import/no-webpack-loader-syntax */

import DDSWorker from 'comlink-loader!./dds.worker'; // inline loader
import DealWorker from 'comlink-loader!./deal.worker'; // inline loader
import { readonlyArray as RA } from 'fp-ts';
import { observable } from 'fp-ts-rxjs';
import { pipe } from 'fp-ts/lib/function';
import { from } from 'rxjs';

import pool from '../lib/pool';
import { SerializedBoard } from '../model/serialization';

const BATCH_SIZE = 100
export const observeDeals = (count: number) =>
  pipe(
    RA.replicate(count / BATCH_SIZE, BATCH_SIZE),
    RA.append(count % BATCH_SIZE),
    pool(() => new DealWorker(), w => b => w.genDeals(b)),
    observable.chain(x => from(x)))

export const observeResults = (boards: ReadonlyArray<SerializedBoard>) =>
  pipe(boards,
    pool(() => new DDSWorker(), w => b => w.getResult(b)))