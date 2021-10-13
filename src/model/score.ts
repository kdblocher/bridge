import { Contract, ContractModifier, Direction, Strain, Vulnerability, eqStrain, minors } from "./bridge";
import { constant, flow, identity, pipe } from "fp-ts/lib/function";
import { either, number, option, readonlyArray } from "fp-ts";

import { assertUnreachable } from "../lib";

export interface ScoreInfo {
  contract: Contract
  declarer: Direction
  tricks: number
  vulnerability: Vulnerability
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

const making = (contract: Contract, tricks: number) =>
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
  pipe(info, whenMaking(oddTricks =>
    contractModMultiplier(info.contract.modifier) *
    ((oddTricks * contractPointMultiplier(info.contract.strain)) + contractFirstTrickModifier(info.contract.strain))))

const isVulnerable = (dir: Direction, vul: Vulnerability) =>  
  vul === "Both"
  || (vul === "EastWest" && (dir === "E" || dir === "W"))
  || (vul === "NorthSouth" && (dir === "N" || dir === "S"))

const vulnerableMultiplier = (dir: Direction, vul: Vulnerability) =>
  50 * (isVulnerable(dir, vul) ? 2 : 1)

const getModified = (modifier: ContractModifier) : option.Option<"Doubled" | "Redoubled"> =>
  modifier === "Undoubled" ? option.none : option.some(modifier)

const overtrickBonus = (dir: Direction, vul: Vulnerability, modifier: ContractModifier) => 
  pipe(modifier,
    getModified,
    option.map(contractModMultiplier),
    option.map(x => x * vulnerableMultiplier(dir, vul)))

const ovetrickPoints: ScoreComponent = info =>
  pipe(getOvertricks(info.contract, info.tricks),
    option.fold(constant(0), overtricks =>
      pipe(
        overtrickBonus(info.declarer, info.vulnerability, info.contract.modifier),
        option.getOrElseW(() => contractPointMultiplier(info.contract.strain)),
        multiplier => overtricks * multiplier)))

const slamPoints: ScoreComponent = info =>
  pipe(info, whenMaking(oddTricks =>
    (isVulnerable(info.declarer, info.vulnerability) ? 1.5 : 1) *
    (info.contract.level === 6 && oddTricks >= 6 ? 500 :
      info.contract.level === 7 && oddTricks >= 7 ? 750 : 0)))

const modifierPoints: ScoreComponent = info =>
  pipe(info, whenMaking(() => {
    switch (info.contract.modifier) {
      case "Undoubled": return 0
      case "Doubled"  : return 50
      case "Redoubled": return 100
      default: return assertUnreachable(info.contract.modifier)
    }
  }))

const doubledPenalties = [50, 100, ...readonlyArray.replicate(11, 150)]

const penaltyPoints: ScoreComponent = info =>
  pipe(getUndertricks(info.contract, info.tricks),
    option.fold(constant(0), undertricks =>
      pipe(info.contract.modifier,
        getModified,
        option.fold(
          () => undertricks * vulnerableMultiplier(info.declarer, info.vulnerability),
          flow(contractModMultiplier,
            multiplier => multiplier * pipe(
              doubledPenalties,
              readonlyArray.takeLeft(undertricks + (isVulnerable(info.declarer, info.vulnerability) ? 1 : 0)),
              readonlyArray.foldMap(number.MonoidSum)(identity)))))))

const scoreComponents = [
  contractPoints,
  ovetrickPoints,
  slamPoints,
  modifierPoints,
  penaltyPoints
]

export const score = (info: ScoreInfo): number => 
  pipe(
    scoreComponents,
    readonlyArray.flap(info),
    readonlyArray.foldMap(number.MonoidSum)(identity))