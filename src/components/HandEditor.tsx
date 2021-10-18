import { option, readonlyArray, readonlyRecord, readonlyTuple } from 'fp-ts';
import { constVoid, flow, pipe } from 'fp-ts/lib/function';
import { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { directions, strains } from '../model/bridge';
import * as Deck from '../model/deck';
import { serializedDealL, serializedHandL } from '../model/serialization';
import { handE } from '../parse/hand';
import { AuctionPositionType, genHands, getResult, selectHand, setHand } from '../reducers/selection';
import { Option } from './core/Monad';

interface HandInputProps {
  type: AuctionPositionType
}
const HandInput = ({ type }: HandInputProps) => {
  const dispatch = useAppDispatch()
  const [value, setValue] = useState<string>("")
  const storageKey = `hand.${type}`

  const encodedHand = useAppSelector(state => pipe(selectHand(state.selection, type), option.map(handE.encode), option.toNullable))

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
  <RankListItem>{Deck.rankStrings[rank - 2]}</RankListItem>

interface SuitProps {
  suit: Deck.Suit
  ranks: ReadonlyArray<Deck.Rank>
}

const HandCol = styled.th `
  width: 15em;
`

const SuitList = styled.ol `
  white-space: nowrap;
  width: 15em;
  margin: 0;
  padding-left: 0;
  list-style: decimal url(data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7) inside;
`

const suitBase = `
  &.S::before { content: "♠"; color: #0000FF }
  &.H::before { content: "♥"; color: #FF0000 }
  &.D::before { content: "♦"; color: #FFA500 }
  &.C::before { content: "♣"; color: #32CD32 }
`

const StrainSpan = styled.span `
  ${suitBase}
  &.N::before { content: "NT"; color: #000000; font-size: 12px; }
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

const Suit = ({ suit, ranks }: SuitProps) => {
  return <SuitListItem className={suit}>
    <RankList>
      {ranks.map((r, i) => <Rank key={i} rank={r} />)}
      {ranks.length === 0 && <RankListItem>-</RankListItem> }
    </RankList>
 </SuitListItem>
}

interface HandProps {
  hand: Deck.Hand
}
const HandView = ({ hand }: HandProps) => {
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
  )
}

const DoubleDummyResult = () => {
  const result = useAppSelector(state => state.selection.result)
  return (!result ? <></> :
    <table>
      <thead>
        <tr>
          <th></th>
          {strains.map((s, i) => <th style={{fontWeight: "normal", verticalAlign: "middle"}} key={i}><StrainSpan className={s} /></th>)}
        </tr>
      </thead>
      <tbody>
        {directions.map((d, i) => <tr key={i}>
          <td>{d}</td>
          {strains.map((s, i) => <td key={i}>{result.results[s][d]}</td>)}
          <td><HandView hand={serializedDealL.reverseGet(result.deal)[d]} /></td>
        </tr>)}
      </tbody>
    </table>)
}

const HandEditor = () => {
  const dispatch = useAppDispatch()
  const [o, r] = [
    useAppSelector(state => selectHand(state.selection, 'opener')),
    useAppSelector(state => selectHand(state.selection, 'responder'))
  ]
  const getResultCallback = useCallback(() => pipe(
    option.Do,
    option.apS('opener', o),
    option.apS('responder', r),
    option.map(flow(
      readonlyRecord.map(serializedHandL.get),
      getResult,
      dispatch)),
    constVoid), [dispatch, o, r])
  
  return (
    <>
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
          <td><Option value={o}>{hand => <HandView hand={hand} />}</Option></td>
          <td><Option value={r}>{hand => <HandView hand={hand} />}</Option></td>
        </tr>
        <tr>
          <td>
            <button type="button" onClick={() => dispatch(genHands())}>Generate</button> <br/>
            <button type="button" onClick={getResultCallback}>Get Results</button> <br/>
          </td>
        </tr>
      </tbody>
    </table>
    <DoubleDummyResult />
    </>
  )
}

export default HandEditor