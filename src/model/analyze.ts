import { either, eitherT, option, readonlyArray, readonlyMap, readonlyNonEmptyArray as RNEA, readonlyRecord as RR, readonlyTuple, refinement, semigroup } from 'fp-ts';
import { constant, flow, pipe } from 'fp-ts/lib/function';
import { ordAscending, ordDescending } from '../lib';
import { ContractBid, contractBids, ContractModifier, Direction, getIsVulnerable, ordContractBid, Strain, Vulnerability } from './bridge';
import { eqScore, making, ordScore, Score, score, zeroScore } from './score';


export type TrickCountsByStrain = RR.ReadonlyRecord<Strain, number>
export type TrickCountsByDirection = RR.ReadonlyRecord<Direction, number>
export type TrickCountsByStrainThenDirection = RR.ReadonlyRecord<Strain, TrickCountsByDirection>
export type TrickCountsByDirectionThenStrain = RR.ReadonlyRecord<Direction, TrickCountsByStrain>

export const flattenNestedCounts = <K1 extends string, K2 extends string, T>(table: RR.ReadonlyRecord<K1, RR.ReadonlyRecord<K2, T>>) =>
  pipe(readonlyArray.Do,
    readonlyArray.apS('inner', pipe(table, RR.toReadonlyArray)),
    readonlyArray.bind('outer', ({ inner }) => pipe(inner[1], RR.toReadonlyArray)),
    readonlyArray.map(({ outer, inner }) => ({ outerKey: outer[0], innerKey: inner[0], value: outer[1] })))

export const transpose = <K1 extends string, K2 extends string, T>(table: RR.ReadonlyRecord<K1, RR.ReadonlyRecord<K2, T>>) : RR.ReadonlyRecord<K2, RR.ReadonlyRecord<K1, T>> =>
  pipe(table,
    flattenNestedCounts,
    RNEA.fromReadonlyArray,
    option.fold(() => ({}),
    RNEA.groupBy(x => x.outerKey)),
    RR.map(flow(
      RNEA.fromReadonlyArray,
      option.fold(() => ({}),
      RNEA.groupBy(x => x.innerKey)),
      RR.map(x => x[0].value))))


type OptimalBid = ContractBid | "Pass"
const initialContractBid: refinement.Refinement<OptimalBid, ContractBid> = (b): b is ContractBid => b !== "Pass"
const initialBids = pipe(
  contractBids,
  readonlyArray.sort(ordContractBid),
  readonlyArray.prepend<OptimalBid>("Pass"))
const ordInitialBidsAscending = ordAscending(initialBids)
const ordInitialBidsDescending = ordDescending(initialBids)

type ContractScorePair = readonly [OptimalBid, Score]
const getDirectionScores = (counts: TrickCountsByStrain) => (isVulnerable: boolean) =>
  pipe(initialBids,
    readonlyArray.map(either.fromPredicate(initialContractBid, () => "Pass" as const)),
    eitherT.match(readonlyArray.Functor)(
      (pass): ContractScorePair => [pass, zeroScore],
      (bid): ContractScorePair => {
        const tricks = counts[bid.strain]
        const modifier: ContractModifier = pipe(
          making({ ...bid, modifier: "Undoubled" }, tricks),
          either.fold(constant("Doubled"), constant("Undoubled")))
        return [bid, score({ contract: { ...bid, modifier}, tricks, isVulnerable })]
      }))

const getAllScores = (table: TrickCountsByDirectionThenStrain) => (vulnerability: Vulnerability) =>
  pipe(table,
    RR.mapWithIndex((direction, counts) =>
      getDirectionScores(counts)(getIsVulnerable(direction, vulnerability))))

// const byContractDescending : ord.Ord<ContractScorePair> =
//   ord.contramap(readonlyTuple.fst)(ordInitialBidsDescending)

const shakeContracts = (contractScorePairs: RNEA.ReadonlyNonEmptyArray<ContractScorePair>) =>
  pipe(contractScorePairs,
    RNEA.map(readonlyTuple.swap),
    readonlyMap.fromFoldable(eqScore, semigroup.max(ordInitialBidsDescending), RNEA.Foldable),
    readonlyMap.toReadonlyArray(ordScore))

const pvs = (direction: Direction, availableMoves: RNEA.ReadonlyNonEmptyArray<ContractScorePair>): OptimalBid => "Pass"

export interface IndependentVariables {
  dealer: Direction
  vulnerability: Vulnerability
}
export const parScore = (table: TrickCountsByStrainThenDirection) => (vars: IndependentVariables): Score => zeroScore
