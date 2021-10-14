import { ContractBid, ContractModifier, Direction, Strain, Vulnerability, contractBids, getIsVulnerable, ordContractBid } from "./bridge";
import { readonlyNonEmptyArray as RNEA, readonlyRecord as RR, either, eitherT, option, readonlyArray, readonlyMap, readonlyNonEmptyArray, readonlyRecord, readonlyTuple, refinement, semigroup } from "fp-ts";
import { Score, eqScore, making, ordScore, score, zeroScore } from "./score";
import { constant, flow, pipe } from "fp-ts/lib/function";
import { ordAscending, ordDescending } from "../lib";

export type TrickCountsByStrain = RR.ReadonlyRecord<Strain, number>
export type TrickCountsByDirection = RR.ReadonlyRecord<Direction, number>
export type TrickCountsByStrainThenDirection = RR.ReadonlyRecord<Strain, TrickCountsByDirection>
export type TrickCountsByDirectionThenStrain = RR.ReadonlyRecord<Direction, TrickCountsByStrain>

const transpose = <K1 extends string, K2 extends string, T>(table: RR.ReadonlyRecord<K1, RR.ReadonlyRecord<K2, T>>) : RR.ReadonlyRecord<K2, RR.ReadonlyRecord<K1, T>> =>
  pipe(readonlyArray.Do,
    readonlyArray.apS('inner', pipe(table, readonlyRecord.toReadonlyArray)),
    readonlyArray.bind('outer', ({ inner }) => pipe(inner[1], readonlyRecord.toReadonlyArray)),
    readonlyArray.map(({ outer, inner }) => ({ outerKey: outer[0], innerKey: inner[0], value: outer[1] })),
    readonlyNonEmptyArray.fromReadonlyArray,
    option.fold(() => ({}),
      readonlyNonEmptyArray.groupBy(x => x.outerKey)),
    readonlyRecord.map(flow(
      readonlyNonEmptyArray.fromReadonlyArray,
      option.fold(() => ({}),
        readonlyNonEmptyArray.groupBy(x => x.innerKey)),
      readonlyRecord.map(x => x[0].value))))


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
    readonlyRecord.mapWithIndex((direction, counts) =>
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
