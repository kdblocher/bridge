/// <reference types="emscripten" />

import { either, option as O, readonlyArray, taskEither as TE } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';

import { transpose, TrickCountsByStrainThenDirection } from '../model/analyze';
import { SerializedBoard, serializedBoardL, serializedDealL } from '../model/serialization';
import { boardE } from '../parse/hand';
import { insertSolutions } from '../services/idb';
import { DealWithSolution, putDeals } from '../services/server';

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
export const getResult = (board: SerializedBoard) : Promise<either.Either<string, DoubleDummyResult>> =>
  pipe(board,
    serializedBoardL.reverseGet,
    boardE.encode,
    generateDDTable,
    result => JSON.parse(result) as DoubleDummyTable,
    (results): DoubleDummyResult => ({ board, results }),
    TE.of,
    TE.chainFirst(flow(readonlyArray.of, insertSolutions)),
    // TE.chainFirst(flow(
    //   (s): DealWithSolution => [
    //     pipe(s.board.deal, serializedDealL.reverseGet),
    //     pipe(s.results, transpose, O.of)
    //   ], readonlyArray.of, putDeals))
  )()