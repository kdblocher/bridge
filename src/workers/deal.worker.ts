import { either, readonlyArray, taskEither } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';

import { deal } from '../model/bridge';
import { newDeck } from '../model/deck';
import { GenerationId } from '../model/job';
import { SerializedDeal, serializedDealL } from '../model/serialization';
import { insertDeals } from '../services/idb';
import { postDeals } from '../services/server';

export const genDeals = (count: number, generationId: GenerationId) : Promise<either.Either<string, ReadonlyArray<SerializedDeal>>> =>
  pipe(
    taskEither.of(readonlyArray.makeBy(count, flow(newDeck, deal, serializedDealL.get))),
    taskEither.chainFirst(insertDeals(generationId)),
    taskEither.chainFirst(flow(readonlyArray.map(serializedDealL.reverseGet), postDeals)))
  ()