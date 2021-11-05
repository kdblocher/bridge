import { either as E, eitherT, eq, option as O, optionT, readonlyArray as RA, readonlyMap as RM, readonlyNonEmptyArray as RNEA, separated, state as S, string, these, tree as T } from 'fp-ts';
import { constant, constVoid, flow, pipe } from 'fp-ts/lib/function';
import { Lens } from 'monocle-ts';
import { Object } from 'ts-toolbelt';

import { assertUnreachable, debug } from '../../lib';
import { Bid, ContractBid, eqBid, isContractBid, makeShape, Shape } from '../bridge';
import { Suit, suits } from '../deck';
import { serializedBidL } from '../serialization';
import { extendForestWithSiblings, Forest } from '../system';
import { ConstrainedBid, Constraint, ConstraintSuitComparison, ConstraintSuitHonors, ConstraintSuitPrimary, ConstraintSuitRange, ConstraintSuitSecondary, ConstraintSuitTop, constraintTrue } from './core';

export const ofS = <A>(x: A) => S.of<ExpandBidContext, A>(x)

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
      E.fromOption((): SyntaxError => "LabelNotFound"),
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

const connective = ({ type, syntax }: SyntaxConnective): S.State<ExpandBidContext, E.Either<SyntaxError, E.Either<Constraint, Syntax>>> =>
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

interface ExpandBidContext {
  bid: Bid
  path: ReadonlyArray<ConstrainedBid>
  siblings: ReadonlyArray<SyntacticBid>
  traversed: ReadonlyArray<ConstrainedBid>
  labels: ReadonlyMap<string, Syntax>
}
const zeroContext: ExpandBidContext = {
  bid: "Pass",
  path: [],
  siblings: RA.empty,
  traversed: RA.empty,
  labels: RM.empty
}

const contextL = Lens.fromProp<ExpandBidContext>()
const bidL = contextL('bid')
const pathL = contextL('path')
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
      E.fromOption((): SyntaxError => "OtherBidNotFound"),
      E.map(E.right))))

interface SyntaxOtherwise {
  type: "Otherwise"
}
const otherwise = pipe(
  S.gets(bidL.get),
  S.chain(bid => S.gets(flow(
    traversedL.get,
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
  RNEA.map((counts: Shape): Syntax =>
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

export type SyntaxError =
  | "NotImplemented"
  | "OtherBidNotFound"
  | "LabelNotFound"
  | "WildcardWithoutBid"
  | "WildcardInNTContext"

export const pure = <A>(x: A) => pipe(x, E.right, E.right, ofS)

type ExpandResult<T> = S.State<ExpandBidContext, E.Either<SyntaxError, T>>
const expandOnce = (s: Syntax): ExpandResult<E.Either<Constraint, Syntax>> => {
  switch (s.type) {
    case "Wrapper":
      return ofS<E.Either<SyntaxError, E.Either<Constraint, Syntax>>>(E.right(E.left(s.constraint)))
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

const expand = (syntax: Syntax) : ExpandResult<Constraint> =>
  pipe(
    syntax,
    expandOnce,
    S.chain(flow(
      E.mapLeft(E.left),
      E.chain(cont => pipe(cont, E.mapLeft(c => E.right(c)))),
      E.fold(ofS, expand))))

export type SyntacticBid = {
  bid: Bid
  syntax: Syntax
}

const expandBid = 
  T.map(({ bid, syntax, siblings }: SyntacticBid & { siblings? : ReadonlyArray<SyntacticBid> }) =>
    pipe(
      ofS(syntax),
      S.apFirst(S.modify(bidL.set(bid))),
      S.apFirst(S.modify(labelsL.modify(RM.upsertAt(string.Eq)(serializedBidL.get(bid), syntax)))),
      S.apFirst(pipe(siblings, O.fromNullable, O.fold(flow(constVoid, ofS), flow(siblingsL.set, S.modify)))),
      S.chain(expand),
      S.map(E.map((constraint): ConstrainedBid => ({ bid, constraint }))),
      S.chainFirst(E.foldW(
        flow(constVoid, ofS),
        /* don't eta reduce this, there is a null bug somewhere in the lib */
        cb => S.modify(pathL.modify(RA.prepend(cb)))))))

const expandPeers =
  T.fold((s: ExpandResult<ConstrainedBid>, bs: ReadonlyArray<S.State<ExpandBidContext, T.Tree<E.Either<SyntaxError, ConstrainedBid>>>>) => 
    pipe(s,
      S.bindTo('result'),
      S.apS('context', S.get()),
      S.map(({ result, context }) =>
        T.make(result,
          pipe(bs,
            S.sequenceArray,
            S.evaluate(context),
            RA.toArray)))))

const expandTree = flow(
  expandBid,
  expandPeers)

const collectErrors = (forest: Forest<E.Either<SyntaxError, ConstrainedBid>>) =>
  pipe(forest,
    RA.map(T.traverse(these.getApplicative(RA.getMonoid<SyntaxError>()))(E.mapLeft(RA.of))),
    RA.sequence(these.getApplicative(RA.getSemigroup<SyntaxError>())))

export const expandForest = (forest: Forest<SyntacticBid>): these.These<ReadonlyArray<SyntaxError>, Forest<ConstrainedBid>> =>
  pipe(forest,
    extendForestWithSiblings(eqSyntacticBid),
    S.traverseArray(expandTree),
    S.evaluate(zeroContext),
    collectErrors)