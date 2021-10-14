/// <reference types="emscripten" />

import { SerializedBoard, SerializedDeal, serializedBoardL } from "../model/serialization"

import { TrickCountsByStrainThenDirection } from "../model/analyze"
import { boardE } from "../parse/hand"
import { pipe } from "fp-ts/lib/function"

interface LibDDSModule extends EmscriptenModule {
	cwrap: typeof cwrap;
}

declare const importScripts: (uri: string) => void
declare const self: any

const Module = {} as LibDDSModule
self.Module = Module
importScripts("./libdds.wasm.min.js")

const generateDDTable : ((board: string) => string) =
  Module.cwrap('generateDDTable', 'string', ['string'])
// const solve : ((board: string, trump: string, plays: number, playsPtr: number) => string) =
//   Module.cwrap('solve', 'string', ['string', 'string', 'number', 'number'])

export type DoubleDummyTable = TrickCountsByStrainThenDirection
export interface DoubleDummyResult {
  deal: SerializedDeal
  results: DoubleDummyTable
}

export const getResult = (board: SerializedBoard) =>
  pipe(board,
    serializedBoardL.reverseGet,
    boardE.encode,
    generateDDTable,
    result => JSON.parse(result) as DoubleDummyTable,
    (results): DoubleDummyResult => ({ ...board, results }))