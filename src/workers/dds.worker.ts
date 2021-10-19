/// <reference types="emscripten" />

import { pipe } from 'fp-ts/lib/function';
import { TrickCountsByStrainThenDirection } from '../model/analyze';
import { SerializedBoard, serializedBoardL } from '../model/serialization';
import { boardE } from '../parse/hand';


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

// Do NOT change this, as this is most definitely the return type of generateDDTable
export type DoubleDummyTable = TrickCountsByStrainThenDirection
export interface DoubleDummyResult {
  board: SerializedBoard
  results: DoubleDummyTable
}
export const getResult = (board: SerializedBoard): DoubleDummyResult =>
  pipe(board,
    x => { debugger; return x },
    serializedBoardL.reverseGet,
    boardE.encode,
    generateDDTable,
    result => JSON.parse(result) as DoubleDummyTable,
    (results): DoubleDummyResult => ({ board, results }))