import { option, readonlyArray as RA, these, tree as T } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import { draw } from 'io-ts/lib/Decoder';
import { Fragment, useMemo } from 'react';
import styled from 'styled-components';

import { useAppSelector } from '../app/hooks';
import { assertUnreachable } from '../lib';
import { Bid } from '../model/bridge';
import { serializedBidPathL } from '../model/serialization';
import { Forest } from '../model/system';
import { ExpandError } from '../model/system/expander';
import { SystemValidationError } from '../model/system/validation';
import { ErrorNode, selectErrorTree, selectPristineSystem, SystemErrorWithPath } from '../reducers/system';
import BidPath, { BidView } from './core/BidPath';

const GridContainer = styled.div `
  clear: both;
  display: inline-grid;
  grid-template-columns: auto auto;
  width: auto;
`

interface ExpandErrorProps {
  error: ExpandError
}
const ExpandErrorView = ({ error }: ExpandErrorProps) =>
  <span>{error.syntax.type}: {error.reason}</span>

interface ValidationErrorProps {
  error: SystemValidationError
}
const ValidationErrorView = ({ error }: ValidationErrorProps) => {
  switch (error.type) {
    case "BidsOutOfOrder": return <span>Bids <BidView bid={error.left.bid} /> and <BidView bid={error.right.bid} /> out of order</span>
    case "SAT": return <span>Path has no solution: <BidPath path={error.path} /></span>
    // case "NoPrimarySuitDefined": return <span>No primary suit defined for secondary suit {error.constraint.suit}</span>
    // case "PrimarySuitAlreadyDefined": return <span>Primary suit has already been defined</span>
    // case "SamePrimaryAndSecondarySuit": return <span>Primary and secondary suits cannot be the same</span>
    // case "TrumpSuitAlreadyDefined": return <span>Trump suit has already been defined</span>
    // case "NoBidDefinedButStillForcing": return <span>Bid is forcing, but no response is defined</span>
    // case "PassWhileForcing": return <span>Previous bid is forcing, but a pass was bid</span>
    // case "SuitRangeInvalid": return <span>Suit {error.constraint.suit} range {error.constraint.min}, {error.constraint.max} is invalid</span>
    // case "PointRangeInvalid": return <span>Point range {error.constraint.min}, {error.constraint.max} is invalid </span>
    // case "SpecificShapeInvalid": return <span>Specific shape {error.constraint.suits.S}{error.constraint.suits.H}{error.constraint.suits.D}{error.constraint.suits.C} is invalid</span>
    // case "AnyShapeInvalid": return <span>Shape {pipe(error.constraint.counts, RA.reduce("", (cur, c) => cur + c))} is invalid</span>
    // case "IllegalContextModification": return <span>Cannot modify the context under a disjunction or negation</span>
    default: return assertUnreachable(error)
  }
}

interface ErrorProps {
  bid: Bid
  errors: ReadonlyArray<SystemErrorWithPath>
}
const BidErrorsView = ({ bid, errors }: ErrorProps) =>
  <div>
    {errors.map((e, i) => {
      switch (e.type) {
        case "Syntax": return <ExpandErrorView key={i} error={e.error} />
        case "Validation": return <ValidationErrorView key={i} error={e.error} />
        default: return assertUnreachable(e)
      }
    })}
    {errors.length === 0 && "none"}
  </div>

interface ErrorGridProps {
  errors: ReadonlyArray<ErrorNode>
}
export const ErrorGrid = ({ errors }: ErrorGridProps) =>
  <GridContainer>
    {errors.map(({ bid, path, errors }) => 
      <Fragment key={serializedBidPathL.get(path)}>
        <BidPath path={path} />
        <BidErrorsView bid={bid} errors={errors} />
      </Fragment>
    )}
  </GridContainer>

interface ErrorForestProps {
  forest: Forest<ErrorNode>
}
const ErrorForest = ({ forest }: ErrorForestProps) => {
  const flattenedForest = useMemo(() => pipe(forest, RA.chain(T.foldMap(RA.getMonoid<ErrorNode>())(RA.of))), [forest])
  return <ErrorGrid errors={flattenedForest} />
}

const Errors = () => {
  const isPristine = useAppSelector(state => pipe(
    selectPristineSystem({ state: state.system, options: state.settings }),
    option.isSome))
  const errors = useAppSelector(state => selectErrorTree({ state: state.system, options: state.settings }))
  return (
    <section>
      <h3>Errors</h3>
      {isPristine ? "None" : <>
        {these.isLeft(errors) && <div>
          <h4>Parse Errors</h4>
          <ul>{errors.left.map((e, i) => <li key={i}><pre>{draw(e)}</pre></li>)}</ul>
        </div>}
        {these.isRight(errors) && <div>
          <h4>Semantic Errors</h4>
          <ErrorForest forest={errors.right} />
        </div>}
      </>}
    </section>
  )
}

export default Errors