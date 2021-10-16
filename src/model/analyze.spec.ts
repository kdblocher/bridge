import * as fc from 'fast-check';
import { readonlyArray, readonlyRecord, semigroup } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';

import { IndependentVariables, parScore, transpose, TrickCountsByDirectionThenStrain, TrickCountsByStrainThenDirection } from './analyze';
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

// examples from http://www.rpbridge.net/7a23.htm
test('par score 6C=', () => {
  const trickTable : TrickCountsByDirectionThenStrain = {
    "N": { "N": 10, "S": 9, "H": 8, "D": 9, "C": 12 },
    "S": { "N": 10, "S": 9, "H": 8, "D": 9, "C": 12 },
    "W": { "N": 3 , "S": 4, "H": 5, "D": 3, "C": 1  },
    "E": { "N": 3 , "S": 4, "H": 5, "D": 3, "C": 1  },
  }
  const vars: IndependentVariables = {
    dealer: "W",
    vulnerability: "Neither"
  }
  const score = parScore(transpose(trickTable))(vars)
  expect(score).toBe(+920)
})

test('par score 5Hx-2', () => {
  // http://www.rpbridge.net/7a23.htm
  const trickTable : TrickCountsByDirectionThenStrain = {
    "N": { "N": 3, "S": 2 , "H": 9, "D": 2 , "C": 9 },
    "S": { "N": 3, "S": 2 , "H": 9, "D": 2 , "C": 9 },
    "W": { "N": 7, "S": 10, "H": 4, "D": 10, "C": 4 },
    "E": { "N": 7, "S": 10, "H": 4, "D": 10, "C": 4 },
  }
  const vars: IndependentVariables = {
    dealer: "W",
    vulnerability: "Both"
  }
  const score = parScore(transpose(trickTable))(vars)
  expect(score).toBe(-500)
})

test('par score 4Cx', () => {
  // http://www.rpbridge.net/7a23.htm
  const trickTable : TrickCountsByDirectionThenStrain = {
    "N": { "N": 9, "S": 9, "H": 5, "D": 10, "C": 4 },
    "S": { "N": 9, "S": 9, "H": 5, "D": 10, "C": 4 },
    "W": { "N": 4, "S": 4, "H": 6, "D": 2 , "C": 9 },
    "E": { "N": 4, "S": 4, "H": 6, "D": 2 , "C": 9 },
  }
  const vars: IndependentVariables = {
    dealer: "W",
    vulnerability: "EastWest"
  }
  const score = parScore(transpose(trickTable))(vars)
  expect(score).toBe(+200)
})

test('par zero', () => {
  const trickTable : TrickCountsByDirectionThenStrain = {
    "N": { "N": 5, "S": 5, "H": 4, "D": 6, "C": 6 },
    "S": { "N": 5, "S": 5, "H": 4, "D": 6, "C": 6 },
    "W": { "N": 3, "S": 5, "H": 6, "D": 3, "C": 3 },
    "E": { "N": 3, "S": 5, "H": 6, "D": 3, "C": 3 },
  }
  const vars: IndependentVariables = {
    dealer: "W",
    vulnerability: "Neither"
  }
  const score = parScore(transpose(trickTable))(vars)
  expect(score).toBe(0)
})

test('par score passouts should be rare', () => fc.assert(
  fc.property(
    trickTableA,
    varsA,
    (table, vars) => parScore(table)(vars) !== 0)))