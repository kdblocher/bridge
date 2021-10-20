import { option, readonlyNonEmptyArray } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { genHandsMatchingExactlyOneOf, genHandsMatchingMoreThanOneOf, genHandsNotMatchingAnyOf, genOnce, getHandsMatchingPath, selectBlockKey } from '../reducers/selection';
import { selectAllCompleteBidPaths, selectCompleteByKey } from '../reducers/system';


const GenerateOnce = () => {
  const dispatch = useAppDispatch()
  return (
    <button type="button" onClick={() => dispatch(genOnce())}>Random</button>
  )
}

const GenerateMatchZero = () => {
  const bidPaths = useAppSelector(state =>
    pipe(selectAllCompleteBidPaths(state.system),
      readonlyNonEmptyArray.fromReadonlyArray,
      option.toNullable))
  const dispatch = useAppDispatch()
  const [minHcp, setMinHcp] = useState<number>(11)
  return <>
    {bidPaths && <span>
      <button type="button" onClick={() => dispatch(genHandsNotMatchingAnyOf(bidPaths, minHcp))}>Zero</button>
      Min HCP
      <input type="number" style={{width: 50}} value={minHcp} onChange={e => setMinHcp(parseInt(e.target.value))} />
    </span>}
  </>
}

const GenerateMatchOne = () => {
  const bidPaths = useAppSelector(state =>
    pipe(selectAllCompleteBidPaths(state.system),
      readonlyNonEmptyArray.fromReadonlyArray,
      option.toNullable))
  const dispatch = useAppDispatch()
  return <>
    {bidPaths && <span>
      <button type="button" onClick={() => dispatch(genHandsMatchingExactlyOneOf(bidPaths))}>One</button>
    </span>}
  </>
}

const GenerateMatchMany = () => {
  const bidPaths = useAppSelector(state =>
    pipe(selectAllCompleteBidPaths(state.system),
      readonlyNonEmptyArray.fromReadonlyArray,
      option.toNullable))
  const dispatch = useAppDispatch()
  return <>
    {bidPaths && <span>
      <button type="button" onClick={() => dispatch(genHandsMatchingMoreThanOneOf(bidPaths))}>Many</button>
    </span>}
  </>
}

const GenerateMatchSelected = () => {
  const blockKey = useAppSelector(state => selectBlockKey(state.selection))
  const bidPath = useAppSelector(state => blockKey !== null ? selectCompleteByKey(state.system, blockKey) : null)
  const dispatch = useAppDispatch()
  return <>
    {bidPath && <button type="button" onClick={() => dispatch(getHandsMatchingPath(bidPath))}>Selected</button>}
  </>
}

const SelectionGenerators = () =>
  <section>
    <h4>Generate Hands</h4>
    <GenerateOnce />
    <GenerateMatchSelected />
    <GenerateMatchZero />
    <GenerateMatchOne />
    <GenerateMatchMany />
  </section>

export default SelectionGenerators