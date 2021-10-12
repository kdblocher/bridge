//Inspired from https://github.com/danvk/dds.js/blob/master/dds.js
//libdds.wasm.min.js copied from https://github.com/danvk/dds.js/blob/master/out.js, which looks to be compiled from https://github.com/dds-bridge/dds
import { readonlyRecord } from "fp-ts"
import { pipe } from "fp-ts/lib/function"
import { Board, Direction, Strain } from "../../model/bridge"
import { SerializedDeal, serializedDealL } from "../../model/serialization"
import { boardE } from "../../parse/hand"
import { LibDDSModule } from "./libdds"

// Do NOT change this line as the compiled libdds injects values into a global variable called "Module"
declare const Module: LibDDSModule
const generateDDTable : ((board: string) => string) = Module.cwrap('generateDDTable', 'string', ['string'])
  // Module['_solve'] = Module.cwrap('solve', 'string', ['string', 'string', 'number', 'number'])

export type DoubleDummyTable = readonlyRecord.ReadonlyRecord<Strain, readonlyRecord.ReadonlyRecord<Direction, number>>
export interface DoubleDummyResult {
  dealer: Direction
  deal: SerializedDeal
  results: DoubleDummyTable
}

export const getDoubleDummyResult = (board: Board) =>
  pipe(board,
    boardE.encode,
    x => { console.log(x); return x },
    generateDDTable,
    x => { console.log(x); return x },
    result => JSON.parse(result) as DoubleDummyTable,
    (table): DoubleDummyResult => ({
      dealer: board.dealer,
      deal: serializedDealL.get(board.deal),
      results: table
    }))

export default getDoubleDummyResult