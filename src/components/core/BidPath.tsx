import { readonlyArray } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import { Fragment } from 'react';
import styled from 'styled-components';

import { ContractBid, NonContractBid } from '../../model/bridge';
import { BidPath } from '../../model/system';

const SuitSpan = styled.span `
  &.S::after { content: "♠"; color: #0000FF; }
  &.H::after { content: "♥"; color: #FF0000; }
  &.D::after { content: "♦"; color: #FFA500; }
  &.C::after { content: "♣"; color: #32CD32; }
  &.N::after { content: "NT" }
`

const ContractBidView = (bid: ContractBid) =>
  <>
    <span>{bid.level}</span>
    <SuitSpan className={bid.strain}></SuitSpan>
  </>

const NonContractBidView = ({ bid }: { bid: NonContractBid }) =>
  <span>{bid}</span>

interface Props {
  path: BidPath
}
const BidPathView = ({ path }: Props) => 
  <>{pipe(path,
    readonlyArray.filter(path => path !== null),
    readonlyArray.map(cb => cb.bid),
    readonlyArray.mapWithIndex((i, bid) =>
      <Fragment key={i}>
        &nbsp;
        {typeof bid === "string"
          ? <NonContractBidView bid={bid} />
          : <ContractBidView {...bid} />}
      </Fragment>))
  }</>

export default BidPathView