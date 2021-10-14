import * as fc from 'fast-check';
import { console, io, number, readonlyArray, readonlyTuple, writer, void as void_, applicative } from 'fp-ts';
import { constTrue, flow, pipe } from 'fp-ts/lib/function';
import { Contract, contractBids, ContractModifier, contractModifiers, fromBid, Strain, strains } from './bridge';
import { score, ScoreInfo, scoreW } from './score';
import { allPossibleScores } from './score.testdata';

const levelA: fc.Arbitrary<number> =
  fc.integer({ min: 1, max: 7 })
const strainA: fc.Arbitrary<Strain> =
  fc.constantFrom(...strains)
const modifierA: fc.Arbitrary<ContractModifier> =
  fc.constantFrom(...contractModifiers)
const contractA: fc.Arbitrary<Contract> =
  fc.tuple(levelA, strainA, modifierA)
    .map(([level,  strain,  modifier ]) =>
         ({level,  strain,  modifier }))

const tricksA: fc.Arbitrary<number> =
  fc.integer({ min: 0, max: 13 })
const isVulnerableA: fc.Arbitrary<boolean> =
  fc.boolean()
const scoreInfoA: fc.Arbitrary<ScoreInfo> =
  fc.tuple(contractA, tricksA, isVulnerableA)
    .map(([contract,  tricks,  isVulnerable ]) =>
         ({contract,  tricks,  isVulnerable }))

test('no runtime errors', () => fc.assert(
  fc.property(
    scoreInfoA,
    flow(score, constTrue))))

test('score within possible values', () => fc.assert(
  fc.property(
    scoreInfoA,
    fc.context(),
    (info, context) => pipe(
      info,
      scoreW,
      writer.map(s => readonlyArray.elem(number.Eq)(s, allPossibleScores)),
      w => w(),
      readonlyTuple.mapSnd(
        readonlyArray.foldMap(applicative.getApplicativeMonoid(io.Applicative)(void_.Monoid))(([name, score]) =>
          () => context.log(`${name}: ${score}`))),
      ([result, log]) => {
        if (!result) log()
        return result
      })),
  { numRuns: 500 }))