import * as Deck from "../model/deck"

import { AuctionPositionType, genHands, genManyHands, selectHand, setHand } from "../reducers/selection"
import { option, readonlyArray, readonlyRecord, readonlyTuple } from "fp-ts"
import { useAppDispatch, useAppSelector } from "../app/hooks"
import { useCallback, useEffect, useState } from "react"

import { HandE } from "../parse/hand"
import { Option } from "./core/Monad"
import { pipe } from "fp-ts/lib/function"
import styled from "styled-components"

interface HandProps {
  type: AuctionPositionType
}
const HandInput = ({ type }: HandProps) => {
  const dispatch = useAppDispatch()
  const [value, setValue] = useState<string>("")
  const storageKey = `hand.${type}`

  const encodedHand = useAppSelector(state => pipe(selectHand(state.selection, type), option.map(HandE.encode), option.toNullable))

  const onSetHand = useCallback((hand: string) => {
    setValue(hand)
    dispatch(setHand(hand, type))
  }, [dispatch, type])

  useEffect(() => {
    const savedHand = localStorage.getItem(storageKey)
    if (savedHand) {
      onSetHand(savedHand)
    }
  }, [onSetHand, storageKey, type])

  return <input type="text" placeholder="AKQJ.T987.654.32" value={encodedHand ?? value} onChange={e => onSetHand(e.target.value)} onBlur={() => localStorage.setItem(storageKey, value)} />
}

const RankList = styled.ol `
  padding-left: 0;
`

const RankListItem = styled.li `
  list-style-type: none;
  display: inline;
  float: left;
`

interface RankProps {
  rank: Deck.Rank
}
const Rank = ({ rank }: RankProps) =>
  <RankListItem>{Deck.ranks[rank - 2]}</RankListItem>

interface SuitProps {
  suit: Deck.Suit
  ranks: ReadonlyArray<Deck.Rank>
}

const HandCol = styled.th `
  width: 15em;
`

const SuitList = styled.ol `
  white-space: nowrap;
  padding-left: 0;
  list-style: decimal url(data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7) inside;
`

const SuitListItem = styled.li `
  display: inline;
  &::before {
    display: inline;
    float: left;
    margin-left: 5px;
  }
  &.S::before { content: "♠"; color: #0000FF; }
  &.H::before { content: "♥"; color: #FF0000; }
  &.D::before { content: "♦"; color: #FFA500; }
  &.C::before { content: "♣"; color: #32CD32; }
`

const Suit = ({ suit, ranks }: SuitProps) => {
  return <SuitListItem className={suit}>
    <RankList>
      {ranks.map((r, i) => <Rank key={i} rank={r} />)}
      {ranks.length === 0 && <RankListItem>-</RankListItem> }
    </RankList>
 </SuitListItem>
}

const Hand = ({ type }: HandProps) => {
  const hand = useAppSelector(state => selectHand(state.selection, type))
  return <>{hand &&
    <Option value={hand}>{hand => {
      const groupedHand = Deck.groupHandBySuits(hand)
      return (
        <SuitList>
          {pipe(groupedHand,
            readonlyRecord.mapWithIndex((suit, ranks) =>
              <Suit key={suit} suit={suit} ranks={ranks} />),
            readonlyRecord.toReadonlyArray,
            readonlyArray.sort(Deck.getOrdGroupedHand<JSX.Element>()),
            readonlyArray.map(readonlyTuple.snd))}
        </SuitList>
      )}}
    </Option>
  }</>
}

const HandEditor = () => {
  const dispatch = useAppDispatch()
  const [count, setCount] = useState<number>(10000)
  const generating = useAppSelector(state => state.selection.generating)

  return (
    <table>
      <thead>
        <tr>
          <HandCol>Opener</HandCol>
          <HandCol>Responder</HandCol>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><HandInput type="opener" /></td>
          <td><HandInput type="responder" /></td>
        </tr>
        <tr>
          <td><Hand type="opener" /></td>
          <td><Hand type="responder" /></td>
        </tr>
        <tr>
          <td>
            <button type="button" onClick={() => dispatch(genHands())}>Generate</button> <br/>
            <button type="button" onClick={() => dispatch(genManyHands(count))}>Generate lots of hands</button>
            <input type="number" value={count} onChange={e => setCount(parseInt(e.target.value))} />
            {generating && <span>Generating...</span>}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

export default HandEditor