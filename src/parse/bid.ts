import { either, eitherT, option, readonlyArray, readonlyNonEmptyArray, readonlyRecord, string } from 'fp-ts';
import { constant, flow, identity, pipe } from 'fp-ts/lib/function';

import { assertUnreachable } from '../lib';
import { Bid, Strain, zeroSpecificShape } from '../model/bridge';
import { constConstraintFalse, constConstraintTrue, ConstrainedBid, Constraint, SuitComparisonOperator, SuitRangeSpecifier } from '../model/constraints';
import { rankFromString, ranks, Suit } from '../model/deck';
import * as AST from '../parse/bid.peg.g';

const getConnectiveItems = (items: ReadonlyArray<AST.Constraint>) =>
  pipe(items,
    readonlyNonEmptyArray.fromReadonlyArray,
    option.map(flow(
      readonlyNonEmptyArray.map(constraint),
      either.fromPredicate(i => i.length > 1, i => i[0]))))

const connective = (type: "Conjunction" | "Disjunction", zero: () => Constraint) =>
  flow(getConnectiveItems,
    eitherT.match(option.Functor)(identity, constraints => ({
      type,
      constraints
    }) as const),
    option.getOrElse(zero))

const suit = (s: AST.Suit) : Suit =>
  s.kind === AST.ASTKinds.Club    ? 'C' :
  s.kind === AST.ASTKinds.Diamond ? 'D' :
  s.kind === AST.ASTKinds.Heart   ? 'H' :
                                    'S'

const strain = (s: AST.Strain) : Strain =>
  s.kind === AST.ASTKinds.Notrump ? 'N' :
  suit(s)

const suitSpecifier = (s: AST.SuitRangeSpecifier) : SuitRangeSpecifier =>
  // s.kind === AST.ASTKinds.Major ? "Major" :
  // s.kind === AST.ASTKinds.Minor ? "Minor" :
  suit(s)

const bindValueQualifier = (s: AST.BoundQualifier, value: number) => (type: 'min' | 'max') =>
  pipe(value,
    option.of,
    option.filter(_ =>
      s.kind === AST.ASTKinds.Equals
      || (type === 'min' && s.kind === AST.ASTKinds.Plus)
      || (type === 'max' && s.kind === AST.ASTKinds.Minus)))

const constraintList = (c: AST.ConstraintList) : Constraint =>
  pipe(c,
    readonlyArray.map(c => c.constraint),
    connective("Conjunction", constConstraintFalse))

export const constraint = (c: AST.Constraint) : Constraint => {
  switch (c.kind) {

    case AST.ASTKinds.True:
      return constConstraintTrue()

    case AST.ASTKinds.False:
      return constConstraintFalse()

    case AST.ASTKinds.And:
      return pipe(
        c.constraints,
        readonlyArray.map(c => c.constraint),
        connective("Conjunction", constConstraintTrue))

    case AST.ASTKinds.Otherwise:
      return { type: "Otherwise" }

    case AST.ASTKinds.Or:
      const flatten = (head: AST.Constraint, ...items: ReadonlyArray<AST.Constraint>) : readonlyNonEmptyArray.ReadonlyNonEmptyArray<AST.Constraint> =>
        head.kind === AST.ASTKinds.Or
        ? flatten(head.left, head.right, ...items)
        : pipe(items,
            readonlyNonEmptyArray.fromReadonlyArray,
            option.fold(
              () => [head],
              items => [head, ...flatten(items[0], ...items.slice(1))]))
      return pipe(
        flatten(c.left, c.right),
        connective("Disjunction", constConstraintFalse))

    case AST.ASTKinds.Not:
      return {
        type: "Negation",
        constraint: constraint(c.constraint)
      }

    case AST.ASTKinds.OtherBid:
      return {
        type: "OtherBid",
        bid: {
          level: c.level.value,
          strain: strain(c.strain)
        }
      }

    case AST.ASTKinds.PointRange:
      return {
        type: "PointRange",
        min: c.lower.value,
        max: c.upper.value
      }

    case AST.ASTKinds.PointBound:
      return {
        type: "PointRange",
        min: pipe(bindValueQualifier(c.qualifier, c.value.value)('min'), option.getOrElse(constant(0))),
        max: pipe(bindValueQualifier(c.qualifier, c.value.value)('max'), option.getOrElse(constant(37))),
      }

    case AST.ASTKinds.SuitRange:
      return {
        type: "SuitRange",
        min: c.lower.value,
        max: c.upper.value,
        suit: suitSpecifier(c.suit)
      }

    case AST.ASTKinds.SuitComparison:
      return {
        type: "SuitComparison",
        op: c.op.v as SuitComparisonOperator,
        left: suit(c.left),
        right: suit(c.right)
      }

    case AST.ASTKinds.Primary:
    case AST.ASTKinds.Secondary:
      return {
        type: `Suit${c.kind}`,
        suit: suit(c.suit)
      }

    case AST.ASTKinds.SuitBound:
      return {
        type: "SuitRange",
        min: pipe(bindValueQualifier(c.qualifier, c.value.value)('min'), option.getOrElse(constant(0))),
        max: pipe(bindValueQualifier(c.qualifier, c.value.value)('max'), option.getOrElse(constant(13))),
        suit: suitSpecifier(c.suit)
      }

    case AST.ASTKinds.SuitHonors:
      return {
        type: "SuitHonors",
        suit: suit(c.suit),
        honors: pipe(c.honors,
          readonlyArray.fromArray,
          readonlyArray.traverse(option.Applicative)(flow(h => h.v, rankFromString)),
          option.getOrElseW(() => []))
      }

    case AST.ASTKinds.SuitTop:
      return {
        type: "SuitTop",
        suit: suit(c.suit),
        count: parseInt(c.x),
        minRank: ranks[ranks.length - parseInt(c.y)]
      }

    case AST.ASTKinds.AnyShape:
      return {
        type: "AnyShape",
        counts: pipe(c.v, string.split(''), readonlyArray.map(parseInt)) as [number, number, number, number]
      }

    case AST.ASTKinds.SpecificShape:
      return {
        type: "SpecificShape",
        suits: pipe(zeroSpecificShape, readonlyRecord.mapWithIndex((s, _) => c[s].value))
      }

    case AST.ASTKinds.Relay:
      return {
        type: "Relay",
        bid: {
          level: c.bid.level.value,
          strain: strain(c.bid.strain)
        }
      }

    case AST.ASTKinds.LabelDef:
      return {
        type: "LabelDef",
        name: c.label.v,
        constraint: constraintList(c.constraints)
      }

    case AST.ASTKinds.LabelRef:
      return {
        type: "LabelRef",
        name: c.label.v
      }
    
    default:
      return { type: c.kind }
  }
}

export const bid = (bid: AST.Bid): Bid => {
  switch (bid.kind) {
    case AST.ASTKinds.ContractBid:
      return {
        level: bid.level.value,
        strain: strain(bid.specifier as AST.Strain),
      }
    case AST.ASTKinds.Pass:
      return "Pass"
    default:
      return assertUnreachable(bid)
  }
}

export const constrainedBid = (bidSpec: AST.BidSpec) : ConstrainedBid => ({
  bid: bid(bidSpec.bid),
  constraint: pipe(
    bidSpec.constraints?.constraints,
    option.fromNullable,
    option.fold(constConstraintFalse, constraintList))
})

export const parseBid = AST.parse
