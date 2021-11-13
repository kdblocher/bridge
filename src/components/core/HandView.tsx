import { readonlyArray, readonlyRecord, readonlyTuple } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import styled from 'styled-components';
import { getOrdGroupedHand, groupHandBySuits, Hand, Rank, rankStrings, Suit } from '../../model/deck';


const RankList = styled.ol `
  padding-left: 0;
`

const RankListItem = styled.li `
  list-style-type: none;
  display: inline;
  float: left;
`

interface RankProps {
  rank: Rank
}
const RankView = ({ rank }: RankProps) =>
  <RankListItem>{rankStrings[rank - 2]}</RankListItem>

const SuitList = styled.ol `
  white-space: nowrap;
  width: 15em;
  margin: 10px;
  padding-left: 0;
  list-style: decimal url(data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7) inside;
`

const suitBase = `
  &.S::before { content: "♠"; color: #0000FF }
  &.H::before { content: "♥"; color: #FF0000 }
  &.D::before { content: "♦"; color: #FFA500 }
  &.C::before { content: "♣"; color: #32CD32 }
`

const SuitListItem = styled.li `
  display: inline;
  &::before {
    display: inline;
    float: left;
    margin-left: 5px;
  }
  ${suitBase}
`

interface SuitProps {
  suit: Suit
  ranks: ReadonlyArray<Rank>
}
const SuitView = ({ suit, ranks }: SuitProps) => {
  return <SuitListItem className={suit}>
    <RankList>
      {ranks.map((r, i) => <RankView key={i} rank={r} />)}
      {ranks.length === 0 && <RankListItem>-</RankListItem> }
    </RankList>
 </SuitListItem>
}

interface HandProps {
  hand: Hand
}
const HandView = ({ hand }: HandProps) => {
  const groupedHand = groupHandBySuits(hand)
  return (
    <SuitList>
      {pipe(groupedHand,
        readonlyRecord.mapWithIndex((suit, ranks) =>
          <SuitView key={suit} suit={suit} ranks={ranks} />),
        readonlyRecord.toReadonlyArray,
        readonlyArray.sort(getOrdGroupedHand<JSX.Element>()),
        readonlyArray.map(readonlyTuple.snd))}
    </SuitList>
  )
}

export default HandView