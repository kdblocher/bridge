import { either, option, readonlyRecord } from 'fp-ts';
import { constVoid, flow, pipe } from 'fp-ts/lib/function';
import { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { serializedHandL } from '../model/serialization';
import { handE } from '../parse/hand';
import { AuctionPositionType, genHands, genHandsUntil, getResult, selectBlockKey, selectHand, setHand } from '../reducers/selection';
import { selectBidsByKey, selectCompleteByKey as selectCompleteBidPathByKey } from '../reducers/system';
import DoubleDummyResultView from './core/DoubleDummyResultView';
import HandView from './core/HandView';
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

const HandCol = styled.th `
  width: 15em;
`

const GenerateUntil = () => {
  const blockKey = useAppSelector(state => selectBlockKey(state.selection))
  const bidPath = useAppSelector(state => blockKey !== null ? selectCompleteBidPathByKey(state.system, blockKey) : null)
  const dispatch = useAppDispatch()
  return <>
    {bidPath && <button type="button" onClick={() => dispatch(genHandsUntil(bidPath))}>Generate Match</button>}
  </>
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

  const result = useAppSelector(state => state.selection.result)
  
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
              <button type="button" onClick={() => dispatch(genHands())}>Generate Once</button>
              <GenerateUntil />
              {/* <button type="button" onClick={() => dispatch(genHands())}>Generate Non-Match</button> */}
              <br/>
              <button type="button" onClick={getResultCallback}>Solution</button> 
            </td>
          </tr>
        </tbody>
      </table>
      {result && <DoubleDummyResultView result={result} /> }
    </>
  )
}

export default HandEditor