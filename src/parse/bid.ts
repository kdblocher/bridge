import { option, readonlyArray, readonlyRecord, string } from 'fp-ts'
import { constant, pipe } from 'fp-ts/lib/function'
import { Strain, zeroSpecificShape } from '../model/bridge'
import { ConstrainedBid, Constraint, SuitComparisonOperator, SuitRangeSpecifier } from '../model/constraints'
import { Suit } from '../model/deck'
import * as AST from '../parse/bid.peg.g'



export const map = (c: AST.ConstraintList) =>
  pipe(c, readonlyArray.map(c => constraintFromAST(c.constraint)))

export const suitFromAST = (s: AST.Suit) : Suit =>
  s.kind === AST.ASTKinds.Club    ? 'C' :
  s.kind === AST.ASTKinds.Diamond ? 'D' :
  s.kind === AST.ASTKinds.Heart   ? 'H' :
                                    'S'

export const strainFromAST = (s: AST.Strain) : Strain =>
  s.kind === AST.ASTKinds.Notrump ? 'N' :
  suitFromAST(s)

export const suitSpecifierFromAST = (s: AST.SuitRangeSpecifier) : SuitRangeSpecifier =>
  s.kind === AST.ASTKinds.Major ? "Major" :
  s.kind === AST.ASTKinds.Minor ? "Minor" :
  suitFromAST(s)

export const bindValueFromASTQualifier = (s: AST.BoundQualifier, value: number) => (type: 'min' | 'max') =>
  pipe(value,
    option.of,
    option.filter(_ =>
      s.kind === AST.ASTKinds.Equals
      || (type === 'min' && s.kind === AST.ASTKinds.Plus)
      || (type === 'max' && s.kind === AST.ASTKinds.Minus)))

export const constraintFromAST = (c: AST.Constraint) : Constraint => {
  if (c.kind === AST.ASTKinds.True) {
    return { type: "Constant", value: true }
  } else if (c.kind === AST.ASTKinds.False) {
    return { type: "Constant", value: false }
  } else if (c.kind === AST.ASTKinds.And) {
    let result = map(c.constraints)
    if (result.length === 1) {
      return result[0]
    } else {
      return {
        type: "Conjunction",
        constraints: map(c.constraints)
      }
    }
  } else if (c.kind === AST.ASTKinds.Or) {
    const [left, right] = [constraintFromAST(c.left), constraintFromAST(c.right)]
    const flatten = (c: Constraint) => c.type === "Disjunction" ? c.constraints : [c]
    return {
      type: "Disjunction",
      constraints: [...flatten(left), ...flatten(right)]
    }
  } else if (c.kind === AST.ASTKinds.Not) {
    return {
      type: "Negation",
      constraint: constraintFromAST(c.constraint)
    }
  } else if (c.kind === AST.ASTKinds.PointRange) {
    return {
      type: "PointRange",
      min: c.lower.value,
      max: c.upper.value
    }
  } else if (c.kind === AST.ASTKinds.PointBound) {
    return {
      type: "PointRange",
      min: pipe(bindValueFromASTQualifier(c.qualifier, c.value.value)('min'), option.getOrElse(constant(0))),
      max: pipe(bindValueFromASTQualifier(c.qualifier, c.value.value)('max'), option.getOrElse(constant(37))),
    }
  } else if (c.kind === AST.ASTKinds.SuitRange) {
    return {
      type: "SuitRange",
      min: c.lower.value,
      max: c.upper.value,
      suit: suitSpecifierFromAST(c.suit)
    }
  } else if (c.kind === AST.ASTKinds.SuitComparison) {
    return {
      type: "SuitComparison",
      op: c.op.v as SuitComparisonOperator,
      left: suitFromAST(c.left),
      right: suitFromAST(c.right)
    }
  } else if (c.kind === AST.ASTKinds.Primary || c.kind === AST.ASTKinds.Secondary) {
    return {
      type: `Suit${c.kind}`,
      suit: suitFromAST(c.suit)
    }
  } else if (c.kind === AST.ASTKinds.SuitBound) {
    return {
      type: "SuitRange",
      min: pipe(bindValueFromASTQualifier(c.qualifier, c.value.value)('min'), option.getOrElse(constant(0))),
      max: pipe(bindValueFromASTQualifier(c.qualifier, c.value.value)('max'), option.getOrElse(constant(13))),
      suit: suitSpecifierFromAST(c.suit)
    }
  } else if (c.kind === AST.ASTKinds.AnyShape) {
    return {
      type: "AnyShape",
      counts: pipe(c.v, string.split(''), readonlyArray.map(parseInt)) as [number, number, number, number]
    }
  } else if (c.kind === AST.ASTKinds.SpecificShape) {
    return {
      type: "SpecificShape",
      suits: pipe(zeroSpecificShape, readonlyRecord.mapWithIndex((s, _) => c[s].value))
    }
  } else if (c.kind === AST.ASTKinds.Relay) {
    return {
      type: "Relay",
      bid: {
        level: c.level.value,
        strain: strainFromAST(c.strain)
      }
    }
  } else {
    return { type: c.kind }
  }
}

export const bidFromAST = (bid: AST.Bid) : ConstrainedBid => ({
  bid: {
    level: bid.level.value,
    strain: strainFromAST(bid.bid as AST.Strain),
  },
  constraint: pipe(bid.constraints,
    readonlyArray.map(c => constraintFromAST(c.constraint)),
    constraints => constraints.length === 1 ? constraints[0] : ({
      type: "Conjunction",
      constraints
    }))
})

export const parseBid = AST.parse
