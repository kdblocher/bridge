import { readonlyArray } from "fp-ts";
import { flow } from "fp-ts/lib/function";
import { deal } from "../../model/bridge";
import { newDeck } from "../../model/deck";
import { serializedDealL } from "../../model/serialization";

export const genDeals = (count: number) =>
  readonlyArray.makeBy(count, flow(newDeck, deal, serializedDealL.get))