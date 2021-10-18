import { option, readonlyArray } from 'fp-ts';
import { observable } from 'fp-ts-rxjs';
import { flow, pipe } from 'fp-ts/lib/function';
import { castDraft } from 'immer';
import { Epic } from 'redux-observable';
import { bufferCount, concatWith, filter } from 'rxjs';

import { AnyAction, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { RootState } from '../app/store';
import { makeBoard } from '../model/bridge';
import { serializedBoardL, serializedDealL } from '../model/serialization';
import { observeDealsParallel, observeResultsSerial } from '../workers';
import { DoubleDummyResult } from '../workers/dds.worker';

const name = 'generator'

interface State {
  results: ReadonlyArray<DoubleDummyResult>
  generating: option.Option<number>
}
const initialState: State = {
  results: [],
  generating: option.none
}

// const genDeals = createAsyncThunk(`${name}/genDeals`, async (count: number) => {
//   const handsPerWorker = Math.floor(count / maxProcessors)
//   const remainder = Math.floor(count % maxProcessors)
//   // return new Worker().genDeals(count)
//   const result = await pipe(readonlyArray.makeBy(maxProcessors - 1, constant(makeGenDealsTask(handsPerWorker))),
//     readonlyArray.prepend(makeGenDealsTask(handsPerWorker + remainder)),
//     task.sequenceArray,
//     task.map(flow(
//       readonlyArray.flatten,
//       readonlyArray.mapWithIndex((i, d) => pipe(d,
//         serializedDealL.reverseGet,
//         makeBoard(i),
//         serializedBoardL.get)))),
//     task.chain(makeGetResultsTask),
//     task => task())
//   return result
// })

const slice = createSlice({
  name,
  initialState,
  reducers: {
    analyzeDeals: (state, action: PayloadAction<number>) => {
      state.results = []
      state.generating = option.some(action.payload)
    },
    reportResults: (state, action: PayloadAction<ReadonlyArray<DoubleDummyResult>>) => {
      state.results = pipe(state.results,
        readonlyArray.concat(action.payload),
        castDraft)
      state.generating = pipe(state.generating,
        option.map(count => count - action.payload.length))
    },
    done: (state) => {
      state.generating = option.none
    }
  }
})

export const { analyzeDeals, reportResults, done } = slice.actions
export default slice.reducer

export const analyzeDealsEpic : Epic<AnyAction, AnyAction, RootState> =
  (action$, state$) => action$.pipe(
    filter(analyzeDeals.match),
    observable.map(a => a.payload),
    observable.chain(flow(
      observeDealsParallel,
      observable.map(flow(
        observable.map(flow(
          serializedDealL.reverseGet,
          makeBoard(0),
          serializedBoardL.get)),
        observeResultsSerial)),
      observable.flatten,
      bufferCount(5),
      observable.map(reportResults),
      concatWith([done()])
      )))
    
export const selectAllDeals = (state: State) =>
  pipe(state.results,
    readonlyArray.map(flow(
      r => r.deal,
      serializedDealL.reverseGet,
      deal => [deal.N, deal.S] as const)))