import { deal } from "../../model/bridge";
import { flow } from "fp-ts/lib/function";
import { newDeck } from "../../model/deck";
import { readonlyArray } from "fp-ts";

export const genDeals = (count: number) =>
  readonlyArray.makeBy(count, flow(newDeck, deal))