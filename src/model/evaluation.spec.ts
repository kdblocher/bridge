import * as fc from 'fast-check';
import { option, readonlyRecord, readonlyTuple } from 'fp-ts';
import { constant, flow } from 'fp-ts/lib/function';

import { ranks, rankStrings } from './deck';
import { getRankHcp } from './evaluation';
import { rankA } from './test-utils';

const hcpValues = {
  'A': 4,
  'K': 3,
  'Q': 2,
  'J': 1,
}
test('honor HCP values', () => fc.assert(
  fc.property(rankA, flow(r =>
    [rankStrings[ranks.indexOf(r)], getRankHcp(r)] as const,
    readonlyTuple.mapFst(flow(
      s => readonlyRecord.lookup(s)(hcpValues),
      option.getOrElse(constant(0)))),
    ([a, b]) => a === b))))