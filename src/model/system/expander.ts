import { either as E, eitherT, option as O, readonlyArray as RA, readonlyMap, readonlyNonEmptyArray as RNEA, readonlyRecord, readonlyTuple, separated, state as S, string } from 'fp-ts';
import { constant, flow, pipe } from 'fp-ts/lib/function';
import { Lens } from 'monocle-ts';
import { Object } from 'ts-toolbelt';

import { assertUnreachable } from '../../lib';
import { Bid, ContractBid, eqBid, isContractBid, makeShape, Shape } from '../bridge';
import { Suit, suits } from '../deck';
import { serializedBidL } from '../serialization';
import { Forest, getAllLeafPaths, getForestFromLeafPaths, Path } from '../system';
import { ConstrainedBid, Constraint, ConstraintSuitComparison, ConstraintSuitHonors, ConstraintSuitPrimary, ConstraintSuitRange, ConstraintSuitSecondary, ConstraintSuitTop } from './core';
import { ValidateS } from './validation';

export type SuitContextSpecifier = "Wildcard" | "Major" | "Minor" | "OtherMajor" | "OtherMinor"
export type SuitSpecifier = SuitContextSpecifier | Suit
const isSuit = (s: string): s is Suit =>
  pipe(suits, RA.elem(string.Eq)(s))
type ContextualSuitSyntax<T extends Constraint> = Object.Replace<T, Suit, SuitSpecifier>
type SyntaxSuitRange = ContextualSuitSyntax<ConstraintSuitRange>
type SyntaxSuitComparison = ContextualSuitSyntax<ConstraintSuitComparison>
type SyntaxSuitHonors = ContextualSuitSyntax<ConstraintSuitHonors>
type SyntaxSuitTop = ContextualSuitSyntax<ConstraintSuitTop>
type SyntaxSuitPrimary = ContextualSuitSyntax<ConstraintSuitPrimary>
type SyntaxSuitSecondary = ContextualSuitSyntax<ConstraintSuitSecondary>
type SyntaxSuit = 
  | SyntaxSuitRange
  | SyntaxSuitComparison
  | SyntaxSuitHonors
  | SyntaxSuitTop
  | SyntaxSuitPrimary
  | SyntaxSuitSecondary

interface SyntaxDistribution {
  type: "Balanced" | "SemiBalanced" | "Unbalanced"
}

interface SyntaxLabelDef {
  type: "LabelDef"
  name: string
  definition: Syntax
}
const labelDef = (s: SyntaxLabelDef) =>
  pipe(
    S.gets(flow(
      labelsL.get,
      readonlyMap.lookup(string.Eq)(s.name))),
    S.chain(O.fold(
      () => ofS(s.definition),
      c0 => ofS({ type: "Conjunction", syntax: [c0, s.definition] } as const))),
    S.chainFirst(syntax => S.modify(labelsL.modify(readonlyMap.upsertAt(string.Eq)(s.name, syntax)))),
    S.map(flow(E.right, E.right)))

interface SyntaxLabelRef {
  type: "LabelRef"
  name: string
}
const labelRef = (s: SyntaxLabelRef) =>
  pipe(
    S.gets(flow(
      labelsL.get,
      E.fromOptionK((): SyntaxError => "LabelNotFound")(
        readonlyMap.lookup(string.Eq)(s.name)),
      E.map(E.right))))
                // optionT.alt(S.Monad)(() => pipe(
          //   S.get<ExpandBidContext>(),
          //   S.map(context => pipe(
          //     S.gets(peersL.get),
          //     S.chain(RA.traverse(S.Applicative)(expandAll)),
          //     S.chain(() => S.gets(flow(
          //       labelsL.get,
          //       readonlyMap.lookup(string.Eq)(c.name)))),
          //     S.evaluate(context))))),
          // S.chain(O.sequence(S.Applicative)),
          // S.chain(O.traverse(S.Applicative)(x => recur(ofS(x)))))

interface SyntaxWrapper {
  type: "Wrapper"
  constraint: Constraint
}
export const wrap = (constraint: Constraint): SyntaxWrapper => ({
  type: "Wrapper",
  constraint
})

interface SyntaxConstant {
  type: "Constant",
  value: boolean
}
export const syntaxTrue  = constant<Syntax>({ type: "Constant", value: true })
export const syntaxFalse = constant<Syntax>({ type: "Constant", value: false })

interface SyntaxConjunction {
  type: "Conjunction"
  syntax: RNEA.ReadonlyNonEmptyArray<Syntax>
}
interface SyntaxDisjunction {
  type: "Disjunction"
  syntax: RNEA.ReadonlyNonEmptyArray<Syntax>
}
interface SyntaxNegation {
  type: "Negation"
  syntax: Syntax
}
type SyntaxConnective =
  | SyntaxConjunction
  | SyntaxDisjunction

const connective = (s: SyntaxConnective): S.State<ExpandBidContext, E.Either<SyntaxError, Syntax>> =>
  pipe(s.syntax,
    RNEA.traverse(S.Applicative)(flow(ofS, expandOnce)),
    S.map(flow(
      RNEA.sequence(E.Applicative),
      E.map(flow(
        RA.separate,
        separated.bimap(
          flow(RNEA.fromReadonlyArray, O.map((constraints): Syntax =>
            wrap({ type: s.type, constraints }))),
          flow(RNEA.fromReadonlyArray, O.map((syntax): Syntax =>
            ({ type: s.type, syntax })))),
        readonlyRecord.toReadonlyArray,
        RA.map(readonlyTuple.snd),
        RA.compact,
        RNEA.fromReadonlyArray,
        O.fold(
          s.type === "Conjunction" ? syntaxTrue : syntaxFalse,
          syntax => ({ type: s.type, syntax })))))))

interface ExpandBidContext {
  bid: Bid
  peers: ReadonlyArray<readonly [Bid, Syntax]>,
  labels: ReadonlyMap<string, Syntax>
}
const zeroContext: ExpandBidContext = {
  bid: "Pass",
  peers: RA.empty,
  labels: readonlyMap.empty
}
/* eslint-disable @typescript-eslint/no-unused-vars */
const contextL = Lens.fromProp<ExpandBidContext>()
const bidL = contextL('bid')
// const pathL = contextL('path')
// const forceL = contextL('force')
// const primarySuitL = contextL('primarySuit')
// const secondarySuitL = contextL('secondarySuit')
const peersL = contextL('peers')
const labelsL = contextL('labels')
// const contextO = Optional.fromOptionProp<BidContext>()
// const forceO = contextO('force')
// const primarySuitO = contextO('primarySuit')
// const secondarySuitO = contextO('secondarySuit')
/* eslint-enable @typescript-eslint/no-unused-vars */

interface SyntaxOtherBid {
  type: "OtherBid",
  bid: ContractBid
}
const otherBid =
  pipe(
    S.gets(bidL.get),
    S.chain(bid => S.gets(flow(
      peersL.get,
      E.fromOptionK((): SyntaxError => "OtherBidNotFound")(
        RA.findFirst(flow(readonlyTuple.fst, b => eqBid.equals(bid, b))))))),
    S.map(E.map(flow(
      readonlyTuple.snd,
      E.right))))

interface SyntaxOtherwise {
  type: "Otherwise"
}
const otherwise = pipe(
  S.gets(bidL.get),
  S.chain(bid => S.gets(flow(
    peersL.get,
    RA.takeLeftWhile(flow(readonlyTuple.fst, b => !eqBid.equals(b, bid)))))),
  S.map(flow(
    RA.map(readonlyTuple.snd),
    RNEA.fromReadonlyArray,
    O.fold(
      syntaxTrue,
      (syntax): Syntax => ({
        type: "Negation", syntax: {
          type: "Conjunction", syntax
        }
      })),
    E.right,
    E.right)))

export type Syntax =
  | SyntaxWrapper
  | SyntaxConstant
  | SyntaxConjunction
  | SyntaxDisjunction
  | SyntaxDistribution
  | SyntaxNegation
  | SyntaxSuit
  | SyntaxLabelDef
  | SyntaxLabelRef
  | SyntaxOtherBid
  | SyntaxOtherwise

const wrapShapes =
  RNEA.map((counts: Shape): Syntax =>
    wrap({ type: "AnyShape", counts }))

const syntaxBalanced : Syntax = {
  type: "Disjunction",
  syntax: wrapShapes([
    makeShape(4, 3, 3, 3),
    makeShape(5, 3, 3, 2),
    makeShape(4, 4, 3, 2),
    makeShape(5, 5, 3, 2)
  ])
}

const syntaxSemiBalanced : Syntax = {
  type: "Disjunction",
  syntax: wrapShapes([
    makeShape(5, 4, 2, 2),
    makeShape(6, 3, 2, 2)
  ])
}


const expandSpecifier = (specifier: SuitSpecifier): S.State<ExpandBidContext, E.Either<SyntaxError, Suit>> => {
  switch (specifier) {
    case "C":
    case "D":
    case "H":
    case "S":
      return ofS(E.right(specifier))
    case "Wildcard":
      return pipe(
        S.gets(flow(bidL.get)),
        S.map(flow(
          E.fromPredicate(isContractBid, (b): SyntaxError => "WildcardWithoutBid"),
          E.chain(b => pipe(b.strain, E.fromPredicate(isSuit, (b): SyntaxError => "WildcardInNTContext"))))))
    default:
      return ofS(E.left("NotImplemented"));
  }
}



type SyntaxError =
  | "NotImplemented"
  | "OtherBidNotFound"
  | "LabelNotFound"
  | "WildcardWithoutBid"
  | "WildcardInNTContext"

export const ofS = <A>(x: A) => S.of<ExpandBidContext, A>(x)
export const pure = <A>(x: A) => pipe(x, E.right, E.right, ofS)

const expandOnce: ValidateS<ExpandBidContext, Syntax, SyntaxError, E.Either<Constraint, Syntax>> =
  S.chain(s => {
    switch (s.type) {
      case "Wrapper":
        return ofS<E.Either<SyntaxError, E.Either<Constraint, Syntax>>>(E.right(E.left(s.constraint)))
      case "Constant":
        return pure(wrap({ type: "Constant", value: s.value }))
      case "Conjunction":
      case "Disjunction":
        return pipe(s, connective, S.map(E.map(E.right)))
      case "Negation": 
        return pipe(s.syntax, ofS, expandOnce, S.map(E.map(flow(
          E.fold(
            (constraint): Syntax => wrap({ type: "Negation", constraint }),
            (syntax): Syntax => ({ type: "Negation", syntax })),
          E.right))))
      case "OtherBid":
        return otherBid
      case "Otherwise":
        return otherwise
      case "LabelDef":
        return labelDef(s)
      case "LabelRef":
        return labelRef(s)
      case "Balanced":
        return pure(syntaxBalanced)
      case "SemiBalanced":
        return pure({ type: "Disjunction", syntax: [syntaxBalanced, syntaxSemiBalanced] })
      case "Unbalanced":
        return pure({ type: "Negation", syntax: {
          type: "Disjunction", syntax: [syntaxBalanced, syntaxSemiBalanced]
        }})
      case "SuitRange":
      case "SuitHonors":
      case "SuitPrimary":
      case "SuitSecondary":
      case "SuitTop":
        return pipe(s.suit,
          expandSpecifier,
          eitherT.map(S.Functor)(suit => E.left({ ...s, suit })))
      case "SuitComparison":
        return pipe([s.left, s.right],
          S.traverseArray(expandSpecifier),
          S.map(E.sequenceArray),
          eitherT.map(S.Functor)(suits => E.left({ ...s, left: suits[0], right: suits[1] })))
            
      default:
        // return ofS(E.right(E.right(syntaxFalse())))
        return assertUnreachable(s)
    }
  })

type ExpandResult = E.Either<SyntaxError, Constraint>
const expand = (syntax: Syntax) : S.State<ExpandBidContext, ExpandResult> =>
  pipe(
    syntax,
    ofS,
    expandOnce,
    S.chain(flow(
      E.mapLeft(E.left),
      E.chain(cont => pipe(cont, E.mapLeft(c => E.right(c)))),
      E.fold(ofS, expand))))

export type SyntacticBid = {
  bid: Bid
  syntax: Syntax
}
export const expandPath = (path: Path<SyntacticBid>) : E.Either<SyntaxError, Path<ConstrainedBid>> =>
  pipe(path,
    S.traverseReadonlyNonEmptyArrayWithIndex((_, info) =>
      pipe(
        ofS(info.syntax),
        S.chainFirst(() => S.modify(bidL.set(info.bid))),
        S.chain(expand),
        eitherT.map(S.Functor)((constraint): ConstrainedBid => ({
          bid: info.bid,
          constraint
        })))),
    x => x,
    S.map(RNEA.sequence(E.Applicative)),
    S.evaluate(zeroContext))

export const expandForest = (forest: Forest<SyntacticBid>) =>
  pipe(forest,
    getAllLeafPaths,
    RA.map(expandPath),
    RA.sequence(E.Applicative),
    E.map(getForestFromLeafPaths({ show: cb => serializedBidL.get(cb.bid) })))