import { Fragment } from 'react';
import styled from 'styled-components';

import { ContractBid } from '../../model/bridge';
import { ConstrainedBid } from '../../model/constraints';

const SuitSpan = styled.span `
  &.S::after { content: "♠"; color: #0000FF; }
  &.H::after { content: "♥"; color: #FF0000; }
  &.D::after { content: "♦"; color: #FFA500; }
  &.C::after { content: "♣"; color: #32CD32; }
  &.N::after { content: "NT" }
`

interface Props {
  path: ReadonlyArray<ConstrainedBid>
}
const BidPath = ({ path }: Props) =>
  <>{path.map(b => b.bid as ContractBid).map((bid, i) =>
    <Fragment key={i}>
      &nbsp;
      <span>{bid.level}</span>
      <SuitSpan className={bid.strain}></SuitSpan>
    </Fragment>)
  }</>

export default BidPath