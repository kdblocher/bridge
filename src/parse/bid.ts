import * as AST from '../parse/bid.peg.g'

import { ConstrainedBid, Constraint, SuitRangeSpecifier, zeroSpecificShape } from '../model/constraints'
import { readonlyArray, readonlyRecord } from 'fp-ts'

import { Strain } from '../model/bridge'
import { pipe } from 'fp-ts/lib/function'

export const map = (c: AST.ConstraintList) =>
  pipe(c, readonlyArray.map(c => constraintFromAST(c.constraint)))

export const suitSpecifierFromAST = (s: AST.SuitRangeSpecifier) : SuitRangeSpecifier =>
  //TODO
  s as SuitRangeSpecifier

export const constraintFromAST = (c: AST.Constraint) : Constraint => {
  if (c.kind === AST.ASTKinds.ConstraintAnd) {
    let result = map(c.constraints)
    if (result.length === 1) {
      return result[0]
    } else {
      return {
        type: "Conjunction",
        constraints: map(c.constraints)
      }
    }
  } else if (c.kind === AST.ASTKinds.ConstraintOr) {
    const [left, right] = [constraintFromAST(c.left), constraintFromAST(c.right)]
    const flatten = (c: Constraint) => c.type === "Disjunction" ? c.constraints : [c]
    return {
      type: "Disjunction",
      constraints: [...flatten(left), ...flatten(right)]
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
      min: c.qualifier.kind === AST.ASTKinds.Plus ? c.value.value : 0,
      max: c.qualifier.kind === AST.ASTKinds.Minus ? c.value.value : 37
    }
  } else if (c.kind === AST.ASTKinds.SuitRange) {
    return {
      type: "SuitRange",
      min: c.lower.value,
      max: c.upper.value,
      suit: suitSpecifierFromAST(c.suit)
    }
  } else if (c.kind === AST.ASTKinds.SuitBound) {
    return {
      type: "SuitRange",
      min: c.qualifier.kind === AST.ASTKinds.Plus ? c.value.value : 0,
      max: c.qualifier.kind === AST.ASTKinds.Minus ? c.value.value : 13,
      suit: suitSpecifierFromAST(c.suit)
    }
  } else if (c.kind === AST.ASTKinds.Shape) {
    return {
      type: "SpecificShape",
      suits: pipe(zeroSpecificShape, readonlyRecord.mapWithIndex((s, _) => c[s].value))
    }
  } else if (c.kind === AST.ASTKinds.Relay) {
    return {
      type: "Relay",
      bid: {
        level: c.level.value,
        strain: c.strain as Strain
      }
    }
  } else {
    return { type: c.kind }
  }
}

export const bidFromAST = (bid: AST.Bid) : ConstrainedBid => ({
  bid: {
    level: bid.level.value,
    strain: bid.bid as Strain,
  },
  constraint: pipe(bid.constraints,
    readonlyArray.map(c => constraintFromAST(c.constraint)),
    constraints => constraints.length === 1 ? constraints[0] : ({
      type: "Conjunction",
      constraints
    }))
})

export const parseBid = AST.parse
