import { constant, flow, pipe } from "fp-ts/lib/function"
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit"
import { makeGenDealsTask, makeGetResultsTask } from "../workers"
import { readonlyArray, readonlyTuple, task } from "fp-ts"
import { serializedBoardL, serializedDealL, serializedHandL } from "../model/serialization"

import { DoubleDummyResult } from "../model/analyze"
import { castDraft } from "immer"
import { makeBoard } from "../model/bridge"

const name = 'generator'

interface State {
  results: ReadonlyArray<DoubleDummyResult>
  generating: boolean
}
const initialState: State = {
  results: [],
  generating: false
}

const maxProcessors = window.navigator.hardwareConcurrency

const genDeals = createAsyncThunk(`${name}/genDeals`, async (count: number) => {
  const handsPerWorker = Math.floor(count / maxProcessors)
  const remainder = Math.floor(count % maxProcessors)
  // return new Worker().genDeals(count)
  const result = await pipe(readonlyArray.makeBy(maxProcessors - 1, constant(makeGenDealsTask(handsPerWorker))),
    readonlyArray.prepend(makeGenDealsTask(handsPerWorker + remainder)),
    task.sequenceArray,
    task.map(flow(
      readonlyArray.flatten,
      readonlyArray.mapWithIndex((i, d) => pipe(d,
        serializedDealL.reverseGet,
        makeBoard(i),
        serializedBoardL.get)))),
    task.chain(makeGetResultsTask),
    task => task())
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
    state.results = pipe(action.payload, castDraft)
    state.generating = false
  })
  .addCase(genDeals.rejected, (state) => {
    state.generating = false
  })
})

export { genDeals }
export default slice.reducer

export const selectAllDeals = (state: State) =>
  pipe(state.results,
    readonlyArray.map(r => pipe(
      [r.deal["N"], r.deal["S"]] as const,
      readonlyTuple.bimap(serializedHandL.reverseGet, serializedHandL.reverseGet))))