import { readonlyArray, readonlyTuple, task, taskEither } from 'fp-ts';
import { constant, pipe } from 'fp-ts/lib/function';
import { castDraft } from 'immer';

import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { serializedDealL, SerializedHand, serializedHandL } from '../model/serialization';
import { ping, postDeals } from '../services/server';
import makeGenDealsTask from './worker';

const name = 'generator'

interface State {
  deals: ReadonlyArray<[SerializedHand, SerializedHand]>
  generating: boolean
}
const initialState: State = {
  deals: [],
  generating: false
}

const maxProcessors = window.navigator.hardwareConcurrency

const genDeals = createAsyncThunk(`${name}/genDeals`, async (count: number) => {
  const handsPerWorker = Math.floor(count / maxProcessors)
  const remainder = Math.floor(count % maxProcessors)
  const result = await pipe(readonlyArray.makeBy(maxProcessors - 1, constant(makeGenDealsTask(handsPerWorker))),
    readonlyArray.prepend(makeGenDealsTask(handsPerWorker + remainder)),
    task.sequenceArray,
    task.map(readonlyArray.flatten),
    task => task())
  pipe(ping,
    taskEither.chain(_ =>
      pipe(result, readonlyArray.map(serializedDealL.reverseGet), postDeals)))()
  return result
})

const slice = createSlice({
  name,
  initialState,
  reducers: {},
  extraReducers: builder => builder
  .addCase(genDeals.pending, (state) => {
    state.generating = true
  })
  .addCase(genDeals.fulfilled, (state, action) => {
    state.deals = pipe(
      action.payload,
      readonlyArray.map(deal =>
        pipe(["N", "S"] as const,
          readonlyTuple.bimap(dir => deal[dir], dir => deal[dir]))),
      castDraft)
    state.generating = false
  })
  .addCase(genDeals.rejected, (state) => {
    state.generating = false
  })
})

export { genDeals };
export default slice.reducer

export const selectAllDeals = (state: State) =>
  pipe(state.deals,
    readonlyArray.map(readonlyTuple.bimap(serializedHandL.reverseGet, serializedHandL.reverseGet)))