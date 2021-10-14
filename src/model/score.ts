import * as t from 'io-ts'

import { Contract, ContractModifier, Strain, eqStrain, minors } from "./bridge";
import { constant, flow, identity, pipe } from "fp-ts/lib/function";
import { writer, either, eq, number, option, ord, readonlyArray, readonlyRecord, writerT, readonlyTuple, tuple } from "fp-ts";

import { assertUnreachable } from "../lib";

export interface ScoreInfo {
  contract: Contract
  tricks: number
  isVulnerable: boolean
}

type ScoreComponent = (info: ScoreInfo) => number

const contractPointMultiplier = (strain: Strain) => 
  pipe(minors, readonlyArray.elem(eqStrain)(strain)) ? 20 : 30

const contractModMultiplier = (modifier: ContractModifier) => {
  switch (modifier) {
    case "Undoubled": return 1
    case "Doubled"  : return 2
    case "Redoubled": return 4
    default: return assertUnreachable(modifier)
  }
}

const contractFirstTrickModifier = (strain: Strain) =>
  strain === "N" ? 10 : 0

const subtractBookTricks = (tricks: number) =>
  tricks - 6

export const making = (contract: Contract, tricks: number) =>
  pipe(
    tricks,
    subtractBookTricks,
    either.fromPredicate(
      oddTricks => oddTricks >= contract.level,
      oddTricks => contract.level - oddTricks))

const getOddTricks =
  flow(making, option.fromEither)

const getOvertricks = (contract: Contract, tricks: number) =>
  pipe(making(contract, tricks),
    option.fromEither,
    option.map(oddTricks => oddTricks - contract.level))

const getUndertricks = (contract: Contract, tricks: number) =>
  pipe(making(contract, tricks),
    either.swap,
    option.fromEither)

const whenMaking = (f: (oddTricks: number) => number) => (info: ScoreInfo) =>
  pipe(getOddTricks(info.contract, info.tricks),
    option.fold(constant(0), f))

const contractPoints: ScoreComponent = info =>
  pipe(info, whenMaking(() =>
    contractModMultiplier(info.contract.modifier) *
    ((info.contract.level * contractPointMultiplier(info.contract.strain)) + contractFirstTrickModifier(info.contract.strain))))

const vulnerableMultiplier = (isVulnerable: boolean) =>
  50 * (isVulnerable ? 2 : 1)

const getModified = (modifier: ContractModifier) : option.Option<"Doubled" | "Redoubled"> =>
  modifier === "Undoubled" ? option.none : option.some(modifier)

const overtrickBonus = (isVulnerable: boolean, modifier: ContractModifier) => 
  pipe(modifier,
    getModified,
    option.map(contractModMultiplier),
    option.map(x => x * vulnerableMultiplier(isVulnerable)))

const overtrickPoints: ScoreComponent = info =>
  pipe(getOvertricks(info.contract, info.tricks),
    option.fold(constant(0), overtricks =>
      pipe(
        overtrickBonus(info.isVulnerable, info.contract.modifier),
        option.getOrElseW(() => contractPointMultiplier(info.contract.strain)),
        multiplier => overtricks * multiplier)))

const slamPoints: ScoreComponent = info =>
  pipe(info, whenMaking(oddTricks =>
    (info.isVulnerable ? 1.5 : 1) *
    (info.contract.level === 6 && oddTricks >= 6 ? 500 :
      info.contract.level === 7 && oddTricks >= 7 ? 1000 : 0)))

const modifierPoints: ScoreComponent = info =>
  pipe(info, whenMaking(() => {
    switch (info.contract.modifier) {
      case "Undoubled": return 0
      case "Doubled"  : return 50
      case "Redoubled": return 100
      default: return assertUnreachable(info.contract.modifier)
    }
  }))

const doubledPenalties = [100, 200, 200, ...readonlyArray.replicate(10, 300)]

const penaltyPoints: ScoreComponent = info =>
  pipe(getUndertricks(info.contract, info.tricks),
    option.fold(constant(0), undertricks =>
      pipe(info.contract.modifier,
        getModified,
        option.fold(
          () => undertricks * vulnerableMultiplier(info.isVulnerable),
          flow(contractModMultiplier,
            multiplier => (multiplier / 2) * pipe(
              doubledPenalties,
              readonlyArray.takeLeft(undertricks + (info.isVulnerable ? 1 : 0)),
              readonlyArray.foldMap(number.MonoidSum)(identity)))),
        x => -x)))

const partScorePoints: ScoreComponent =
  flow(contractPoints, score =>
    score > 0 && score <= 100 ? 50 : 0)

const gamePoints: ScoreComponent = info =>
  pipe(info, contractPoints, score =>
    score >= 100 ? (info.isVulnerable ? 500 : 300) : 0)

const scoreComponents : readonlyRecord.ReadonlyRecord<string, ScoreComponent> = {
  contractPoints : contractPoints,
  overtrickPoints: overtrickPoints,
  slamPoints     : slamPoints,
  modifierPoints : modifierPoints,
  penaltyPoints  : penaltyPoints,
  partScorePoints: partScorePoints,
  gamePoints     : gamePoints,
}

const ScoreC = t.brand(t.number, (i) : i is t.Branded<number, { readonly Score: unique symbol }> => typeof i === "number", 'Score')
export type Score = t.TypeOf<typeof ScoreC>
export const zeroScore = (ScoreC.decode(0) as either.Right<Score>).right
export const eqScore : eq.Eq<Score> = number.Eq
export const ordScore : ord.Ord<Score> = pipe(number.Ord, ord.reverse)

export type ScoreComponentLog = readonly [string, number]

type W = ReadonlyArray<ScoreComponentLog>
export const scoreW = (info: ScoreInfo): writer.Writer<W, Score> => 
  pipe(
    scoreComponents,
    readonlyRecord.flap(info),
    readonlyRecord.traverseWithIndex(writer.getApplicative(readonlyArray.getMonoid<ScoreComponentLog>()))((name, score) => pipe(
      writer.tell([[name, score]] as const),
      writer.map(constant(score)))),
    writer.map(flow(
      readonlyRecord.foldMap(ord.trivial)(number.MonoidSum)(identity),
      ScoreC.decode,
      s => (s as either.Right<Score>).right)),
    writer.map((s): [Score, (w: W) => W] => [s, cs => [["TOTAL", s], ...cs]]),
    writer.pass)

export const score = flow(scoreW, writer.evaluate)