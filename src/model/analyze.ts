import { Direction, Strain } from "./bridge";

import { SerializedDeal } from "./serialization";
import { readonlyRecord } from "fp-ts";

export type DoubleDummyTable = readonlyRecord.ReadonlyRecord<Strain, readonlyRecord.ReadonlyRecord<Direction, number>>
export interface DoubleDummyResult {
  dealer: Direction
  deal: SerializedDeal
  results: DoubleDummyTable
}