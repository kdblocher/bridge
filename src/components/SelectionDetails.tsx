import { either, option, readonlyArray, readonlyRecord, readonlyTuple } from "fp-ts"
import { Either } from "fp-ts/lib/Either"
import { pipe } from "fp-ts/lib/function"
import { DecodeError } from "io-ts/Decoder"
import { draw } from "io-ts/lib/Decoder"
import { useCallback, useEffect, useState } from "react"
import styled from "styled-components"
import { useAppDispatch, useAppSelector } from "../app/hooks"
import { ContractBid } from "../model/bridge"
import * as Deck from "../model/deck"
import { selectHandsSatisfySelectedPath, selectPathsSatisfyHands } from "../reducers"
import { AuctionPositionType, setHand } from "../reducers/selection"
import { selectErrors, selectNodeByKey, selectPathByKey } from "../reducers/system"

interface DecodeProps<T> {
  value: Either<DecodeError, T>
  children: (value: T) => JSX.Element
  onError?: (error: DecodeError) => JSX.Element
}
const Decode = <T extends {}>({value, children: onSuccess, onError }: DecodeProps<T>) => 
  pipe(value, either.fold(
    e => onError ? onError(e) : <span>{draw(e)}</span>,
    onSuccess))

interface HandProps {
  type: AuctionPositionType
}
const HandInput = ({ type }: HandProps) => {
  const dispatch = useAppDispatch()
  const [value, setValue] = useState<string>("")
  const storageKey = `hand.${type}`

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

  return <input type="text" placeholder="AKQJ.T987.654.32" value={value} onChange={e => onSetHand(e.target.value)} onBlur={() => localStorage.setItem(storageKey, value)} />
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

const SuitSpan = styled.span `
  &.S::after { content: "♠"; color: #0000FF; }
  &.H::after { content: "♥"; color: #FF0000; }
  &.D::after { content: "♦"; color: #FFA500; }
  &.C::after { content: "♣"; color: #32CD32; }
  &.N::after { content: "NT" }
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
  const hand = useAppSelector(state => state.selection[type])
  return <>{hand &&
    <Decode value={hand}>{hand => {
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
    </Decode>
  }</>
}

const SelectionDetails = () => {
  const selected = useAppSelector(state => state.selection.selectedBlockKey)

  const path = useAppSelector(state => pipe(selected, option.map(s => selectPathByKey(state.system, s)), option.toNullable))
  const bid = useAppSelector(state => pipe(selected,
    option.chain(s => pipe(selectNodeByKey(state.system, s), option.fromNullable)),
    option.chain(n => n.bid),
    option.chain(option.fromEither),
    option.toNullable))
  const errors = useAppSelector(state => selectErrors(state.system))
  const satisfies = useAppSelector(selectHandsSatisfySelectedPath)
  const results = useAppSelector(selectPathsSatisfyHands)

  return (
    <div>
      {errors.length > 0 && <section>
        <h3>Errors</h3>
        <ul>{errors.map((e, i) => <li key={i}>{draw(e)}</li>)}</ul>
        </section>}

      {path && <section>
        <h3>Selected Path</h3>
        {path.map(x => x.text).join(" > ")}
      </section>}

      {bid && <section>
        <h3>Selected Bid</h3>
        {pipe(bid, option.fromNullable, option.map(JSON.stringify), option.toNullable)}
        {satisfies !== null && <section>
        <h4>Satisfies</h4>
        {satisfies.toString()}
      </section>}
      </section>}

      <section>
        <h3>Test Hands</h3>
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
          </tbody>
        </table>
        
      </section>

      {results !== null && <section>
        <h3>Results</h3>
        <ul>
          {results.map((r, i) => <li key={i}>
            {r.path.map(b => b.bid as ContractBid).map(bid => <>
              &nbsp;
              <span>{bid.level}</span>
              <SuitSpan className={bid.strain}></SuitSpan>
            </>)}
            : &nbsp;
            <span>{r.result.toString()}</span>
          </li>)}
        </ul>
      </section>}
    </div>
  )
}

export default SelectionDetails