import { Fragment } from 'react';
import styled from 'styled-components';

import { Bid, ContractBid, NonContractBid } from '../../model/bridge';

const SuitSpan = styled.span `
  &.S::after { content: "♠"; color: #0000FF; }
  &.H::after { content: "♥"; color: #FF0000; }
  &.D::after { content: "♦"; color: #FFA500; }
  &.C::after { content: "♣"; color: #32CD32; }
  &.N::after { content: "NT" }
`

const ContractBidView = ({ bid }: { bid: ContractBid }) =>
  <>
    <span>{bid.level}</span>
    <SuitSpan className={bid.strain}></SuitSpan>
  </>

const NonContractBidView = ({ bid }: { bid: NonContractBid }) =>
  <span>{bid}</span>

export const BidView = ({ bid }: { bid: Bid }) =>
  typeof bid === "string"
    ? <NonContractBidView bid={bid} />
    : <ContractBidView bid={bid} />
interface Props {
  path: ReadonlyArray<Bid>
}
const BidPath = ({ path }: Props) => 
  <span>{path.map((bid, i) => 
    <Fragment key={i}>
      &nbsp;
      <BidView bid={bid} />
    </Fragment>)
  }</span>

export default BidPath