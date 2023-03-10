import { Button } from '@fluentui/react-components';
import { option } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import { useState } from 'react';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { Paths } from '../model/system';
import { ConstrainedBid } from '../model/system/core';
import { genHandsMatchingExactlyOneOf, genHandsMatchingMoreThanOneOf, genHandsNotMatchingAnyOf, genOnce, getHandsMatchingPath } from '../reducers/selection';
import { selectCompleteBidPathUpToKey, selectValidConstrainedBidPaths } from '../reducers/system';

const GenerateOnce = () => {
  const dispatch = useAppDispatch()
  return (
    <Button onClick={() => dispatch(genOnce())}>Random</Button>
  )
}

interface GenerateSystemProps {
  bidPaths: Paths<ConstrainedBid> | null
}

const GenerateMatchZero = ({ bidPaths }: GenerateSystemProps) => {
  const dispatch = useAppDispatch()
  const [minHcp, setMinHcp] = useState<number>(11)
  return <>
    {bidPaths && <span>
      <Button onClick={() => dispatch(genHandsNotMatchingAnyOf(bidPaths, minHcp))}>Zero</Button>
      Min HCP
      <input type="number" style={{ width: 50 }} value={minHcp} onChange={e => setMinHcp(parseInt(e.target.value))} />
    </span>}
  </>
}

const GenerateMatchOne = ({ bidPaths }: GenerateSystemProps) => {
  const dispatch = useAppDispatch()
  return <>
    {bidPaths && <span>
      <Button onClick={() => dispatch(genHandsMatchingExactlyOneOf(bidPaths))}>One</Button>
    </span>}
  </>
}

const GenerateMatchMany = ({ bidPaths }: GenerateSystemProps) => {
  const dispatch = useAppDispatch()
  return <>
    {bidPaths && <span>
      <Button onClick={() => dispatch(genHandsMatchingMoreThanOneOf(bidPaths))}>Many</Button>
    </span>}
  </>
}

const GenerateMatchSelected = () => {
  const selected = useAppSelector(state => state.selection.selectedBlockKey)
  const bidPath = useAppSelector(state => pipe(selected,
    option.chain(key => selectCompleteBidPathUpToKey({ state: state.system, key })),
    option.toNullable))
  const dispatch = useAppDispatch()
  return <>
    {bidPath && <Button onClick={() => dispatch(getHandsMatchingPath(bidPath))}>Selected</Button>}
  </>
}

const SelectionGenerators = () => {
  const bidPaths = useAppSelector(state =>
    pipe(selectValidConstrainedBidPaths({ state: state.system, options: state.settings }),
      option.toNullable))
  return (
    <section>
      <h4>Generate Hands</h4>
      <GenerateOnce />
      <GenerateMatchSelected />
      <GenerateMatchZero bidPaths={bidPaths} />
      <GenerateMatchOne bidPaths={bidPaths} />
      <GenerateMatchMany bidPaths={bidPaths} />
    </section>)
}

export default SelectionGenerators