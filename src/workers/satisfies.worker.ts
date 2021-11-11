import { number, readonlyArray, taskEither } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';

import { Direction } from '../model/bridge';
import { serializedDealL, SerializedHand, serializedHandL } from '../model/serialization';
import { Path } from '../model/system';
import { ConstrainedBid } from '../model/system/core';
import { satisfiesPath } from '../model/system/satisfaction';
import { getDealsByBatchId } from '../services/idb';

export const satisfies = (path: Path<ConstrainedBid>, opener: SerializedHand, responder: SerializedHand) =>
  pipe(path,
    satisfiesPath(serializedHandL.reverseGet(opener), serializedHandL.reverseGet(responder)))

export const satisfiesBatch = (path: Path<ConstrainedBid>, batchId: string, openerDirection?: Direction, responderDirection?: Direction) =>
  pipe(batchId,
    getDealsByBatchId,
    taskEither.map(flow(
      readonlyArray.map(serializedDealL.reverseGet),
      readonlyArray.foldMap(number.MonoidSum)(d =>
        pipe(path,
          satisfiesPath(d[openerDirection ?? "N"], d[responderDirection ?? "S"])) ? 1 : 0))))
    ()