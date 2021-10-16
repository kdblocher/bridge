import * as fc from 'fast-check';
import { readonlyArray, readonlyRecord, semigroup } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';

import { IndependentVariables, parScore, TrickCountsByStrainThenDirection } from './analyze';
import { Direction, directions, strains, vulnerabilities, Vulnerability } from './bridge';

const dirA: fc.Arbitrary<Direction> =
  fc.constantFrom(...directions)
const vulA: fc.Arbitrary<Vulnerability> =
  fc.constantFrom(...vulnerabilities)
const varsA : fc.Arbitrary<IndependentVariables> =
  fc.tuple(dirA, vulA)
    .map(([dealer, vulnerability]) =>
         ({dealer, vulnerability}))
const trickTableA: fc.Arbitrary<TrickCountsByStrainThenDirection> =
  fc.array(fc.integer({ min: 0, max: 13 }), ({ minLength: 20, maxLength: 20 })).map(counts =>
    pipe(readonlyArray.Do,
      readonlyArray.apS('strain', strains),
      readonlyArray.apS('direction', directions),
      readonlyArray.zip(counts),
      readonlyArray.map(([{ strain, direction }, count]) => [strain, [[direction, count]]] as const),
      readonlyRecord.fromFoldable(readonlyArray.getSemigroup<readonly [Direction, number]>(), readonlyArray.Foldable),
      readonlyRecord.map(
        readonlyRecord.fromFoldable(semigroup.first<number>(), readonlyArray.Foldable))))

test('no passing', () => fc.assert(
  fc.property(
    trickTableA,
    varsA,
    (table, vars) => parScore(table)(vars) !== 0)))