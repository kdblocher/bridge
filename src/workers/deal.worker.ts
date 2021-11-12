import { readonlyArray, taskEither } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';

import { deal } from '../model/bridge';
import { newDeck } from '../model/deck';
import { serializedDealL } from '../model/serialization';
import { insertDeals } from '../services/idb';

export const genDeals = (count: number, collectionId?: string) =>
  pipe(
    taskEither.of(readonlyArray.makeBy(count, flow(newDeck, deal, serializedDealL.get))),
    taskEither.chainFirst(insertDeals(collectionId)))
  ()