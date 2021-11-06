import { either as E, eitherT, eq, option as O, optionT, readonlyArray as RA, readonlyMap as RM, readonlyNonEmptyArray as RNEA, separated, state as S, string, these, tree as T } from 'fp-ts';
import { constant, constVoid, flow, pipe } from 'fp-ts/lib/function';
import { Lens } from 'monocle-ts';
import { Object } from 'ts-toolbelt';

import { assertUnreachable } from '../../lib';
import { Bid, ContractBid, eqBid, isContractBid } from '../bridge';
import { Suit, suits } from '../deck';
import { AnyShape, makeShape } from '../evaluation';
import { serializedBidL } from '../serialization';
import { collectErrors, extendForestWithSiblings, Forest } from '../system';
import { ConstrainedBid, Constraint, ConstraintSuitComparison, ConstraintSuitHonors, ConstraintSuitPrimary, ConstraintSuitRange, ConstraintSuitSecondary, ConstraintSuitTop, constraintTrue } from './core';

export const ofS = <A>(x: A) => S.of<ExpandContext, A>(x)

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
      RM.lookup(string.Eq)(s.name))),
    S.chain(O.fold(
      () => ofS(s.definition),
      c0 => ofS({ type: "Conjunction", syntax: [c0, s.definition] } as const))),
    S.chainFirst(syntax => S.modify(labelsL.modify(RM.upsertAt(string.Eq)(s.name, syntax)))),
    S.map(flow(E.right, E.right)))

interface SyntaxLabelRef {
  type: "LabelRef"
  name: string
}
const labelRef = (s: SyntaxLabelRef) =>
  pipe(
    S.gets(flow(
      labelsL.get,
      RM.lookup(string.Eq)(s.name))),
    S.map(flow(
      E.fromOption((): ExpandErrorReason => "LabelNotFound"),
      E.map(E.right))))

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

const connective = ({ type, syntax }: SyntaxConnective): S.State<ExpandContext, E.Either<ExpandErrorReason, E.Either<Constraint, Syntax>>> =>
  pipe(syntax,
    RNEA.traverse(S.Applicative)(expandOnce),
    S.map(flow(
      RA.wilt(E.Applicative)(x => x),
      E.map(flow(
        separated.bimap(RNEA.fromReadonlyArray, RNEA.fromReadonlyArray),
        x => these.fromOptions(x.left, x.right),
        O.fold(
          () => E.left(type === "Conjunction" ? constraintTrue() : constraintTrue()),
          these.match(
            constraints => E.left(constraints.length === 1 ? constraints[0] : { type, constraints }),
            syntax => E.right(syntax.length === 1 ? syntax[0] : { type, syntax }),
            (constraints, syntax): E.Either<never, Syntax> => E.right(
              { type: type,
                syntax: [wrap({ type, constraints }), { type, syntax }]
              }))))))))

type ExpandResult = E.Either<ExpandError, ConstrainedBid>
interface ExpandContext {
  bid: Bid
  pathReversed: ReadonlyArray<Bid>
  siblings: ReadonlyArray<SyntacticBid>
  traversed: ReadonlyArray<ExpandResult>
  labels: ReadonlyMap<string, Syntax>
}
const zeroContext: ExpandContext = {
  bid: "Pass",
  pathReversed: [],
  siblings: RA.empty,
  traversed: RA.empty,
  labels: RM.empty
}

const contextL = Lens.fromProp<ExpandContext>()
const bidL = contextL('bid')
const pathReversedL = contextL('pathReversed')
const siblingsL = contextL('siblings')
const traversedL = contextL('traversed')
const labelsL = contextL('labels')

interface SyntaxOtherBid {
  type: "OtherBid",
  bid: ContractBid
}
const eqSyntacticBid = pipe(eqBid, eq.contramap((sb: SyntacticBid) => sb.bid));

const otherBid = (bid: Bid) =>
  pipe(
    S.gets(flow(
      siblingsL.get,
      RA.findFirst(sb => eqBid.equals(sb.bid, bid)),
      O.map(sb => sb.syntax))),
    optionT.alt(S.Monad)(() => S.gets(flow(
      labelsL.get,
      RM.lookup(string.Eq)(serializedBidL.get(bid))))),
    S.map(flow(
      E.fromOption((): ExpandErrorReason => "OtherBidNotFound"),
      E.map(E.right))))

interface SyntaxOtherwise {
  type: "Otherwise"
}
const otherwise = pipe(
  S.gets(bidL.get),
  S.chain(bid => S.gets(flow(
    traversedL.get,
    RA.rights,
    RA.takeLeftWhile(cb => !eqBid.equals(cb.bid, bid)),
    RA.map(cb => cb.constraint)))),
  S.map(flow(
    RNEA.fromReadonlyArray,
    O.fold(
      constraintTrue,
      (constraints): Constraint => ({
        type: "Negation", constraint: {
          type: "Conjunction", constraints
        }
      })),
    E.left,
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
  RNEA.map((counts: AnyShape): Syntax =>
    wrap({ type: "AnyShape", counts }))

const syntaxBalanced : Syntax = {
  type: "Disjunction",
  syntax: wrapShapes([
    makeShape(4, 3, 3, 3),
    makeShape(5, 3, 3, 2),
    makeShape(4, 4, 3, 2)
  ])
}

const syntaxSemiBalanced : Syntax = {
  type: "Disjunction",
  syntax: wrapShapes([
    makeShape(5, 4, 2, 2),
    makeShape(6, 3, 2, 2)
  ])
}

const expandSpecifier = (specifier: SuitSpecifier): S.State<ExpandContext, E.Either<ExpandErrorReason, Suit>> => {
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
          E.fromPredicate(isContractBid, (b): ExpandErrorReason => "WildcardWithoutBid"),
          E.chain(b => pipe(b.strain, E.fromPredicate(isSuit, (b): ExpandErrorReason => "WildcardInNTContext"))))))
    default:
      return ofS(E.left("NotImplemented"));
  }
}

export type ExpandErrorReason =
  | "NotImplemented"
  | "OtherBidNotFound"
  | "LabelNotFound"
  | "WildcardWithoutBid"
  | "WildcardInNTContext"

export interface ExpandError {
  reason: ExpandErrorReason
  syntax: Syntax
  path: ReadonlyArray<Bid>
}

export const pure = <A>(x: A) => pipe(x, E.right, E.right, ofS)

const expandOnce = (s: Syntax): S.State<ExpandContext, E.Either<ExpandErrorReason, E.Either<Constraint, Syntax>>> => {
  switch (s.type) {
    case "Wrapper":
      return ofS<E.Either<ExpandErrorReason, E.Either<Constraint, Syntax>>>(E.right(E.left(s.constraint)))
    case "Constant":
      return pure(wrap({ type: "Constant", value: s.value }))
    case "Conjunction":
    case "Disjunction":
      return connective(s)
    case "Negation": 
      return pipe(s.syntax, expandOnce, S.map(E.map(flow(
        E.bimap(
          (constraint) => ({ type: "Negation", constraint }),
          (syntax) => ({ type: "Negation", syntax }))))))
    case "OtherBid":
      return otherBid(s.bid)
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
}

const expand = (syntax: Syntax) : S.State<ExpandContext, E.Either<ExpandErrorReason, Constraint>> =>
  pipe(
    syntax,
    expandOnce,
    S.chain(flow(
      E.mapLeft(E.left),
      E.chain(flow(E.mapLeft(c => E.right(c)))),
      E.fold(ofS, expand))))

export type SyntacticBid = {
  bid: Bid
  syntax: Syntax
}

const modifyContext = <T>(...modifiers: ReadonlyArray<(c: T) => T>) =>
  pipe(modifiers, S.traverseArray(S.modify), S.map(constVoid))

const expandBid = 
  T.map(({ bid, syntax, siblings }: SyntacticBid & { siblings : ReadonlyArray<SyntacticBid> }) =>
    pipe(
      modifyContext(
        bidL.set(bid),
        pathReversedL.modify(RA.prepend(bid)),
        siblingsL.set(siblings),
        labelsL.modify(RM.upsertAt(string.Eq)(serializedBidL.get(bid), syntax)),
      ),
      S.apSecond(expand(syntax)),
      S.chain(e => pipe(
        S.gets(pathReversedL.get),
        S.map(path => pipe(e, E.mapLeft((reason): ExpandError => ({ reason, path: RA.reverse(path), syntax })))))),
      S.map(E.map((constraint): ConstrainedBid => ({ bid, constraint })))))

const traversePeers =
  S.chainFirst((t: T.Tree<ExpandResult>) =>
    modifyContext(
      traversedL.modify(RA.append(t.value)),
      pathReversedL.modify(flow(RA.tail, O.getOrElseW(() => RA.empty)))))

type ExpandedBid = S.State<ExpandContext, ExpandResult>
const expandPeers =
  T.fold((expandedBid: ExpandedBid, expandedChildForest: ReadonlyArray<S.State<ExpandContext, T.Tree<ExpandResult>>>) => 
    pipe(expandedBid,
      S.bindTo('result'),
      S.apS('context', S.get()),
      S.map(({ result, context }) =>
        T.make(result,
          pipe(expandedChildForest,
            S.traverseArray(traversePeers),
            S.evaluate(context),
            RA.toArray)))))

export const expandForest = (forest: Forest<SyntacticBid>) =>
  pipe(forest,
    extendForestWithSiblings(eqSyntacticBid),
    RA.map(flow(expandBid, expandPeers)),
    S.traverseArray(traversePeers),
    S.evaluate(zeroContext),
    collectErrors)