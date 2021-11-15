import { either, readonlyArray, taskEither as TE } from 'fp-ts';
import { apply, flow, pipe } from 'fp-ts/lib/function';

import { Direction } from '../model/bridge';
import { GenerationId, getBidPathHash } from '../model/job';
import { serializedDealL, SerializedHand, serializedHandL } from '../model/serialization';
import { Path } from '../model/system';
import { ConstrainedBid } from '../model/system/core';
import { satisfiesPath } from '../model/system/satisfaction';
import { getDealsByBatchId, insertSatisfies } from '../services/idb';
import { SatisfiesBatchResult } from './';

export const satisfies = (path: Path<ConstrainedBid>, opener: SerializedHand, responder: SerializedHand) =>
  pipe(path,
    satisfiesPath(serializedHandL.reverseGet(opener), serializedHandL.reverseGet(responder)))

export const satisfiesBatch = (path: Path<ConstrainedBid>, batchId: string, generationId: GenerationId, openerDirection?: Direction, responderDirection?: Direction) : Promise<either.Either<string, SatisfiesBatchResult>> =>
  pipe(TE.Do,
    TE.apS('testedDeals', pipe(batchId, getDealsByBatchId)),
    TE.bind('satisfiesDeals', ({ testedDeals }) => TE.of(
      pipe(testedDeals,
        readonlyArray.filter(flow(
          serializedDealL.reverseGet,
          d => satisfiesPath(d[openerDirection ?? "N"], d[responderDirection ?? "S"]),
          apply(path)))))),
    TE.chainFirst(({ satisfiesDeals }) => insertSatisfies(generationId, getBidPathHash(path))(satisfiesDeals)),
    TE.map((o): SatisfiesBatchResult => ({
      testedCount: o.testedDeals.length,
      satisfiesCount: o.satisfiesDeals.length
    })))()
    