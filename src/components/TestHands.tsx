import { option } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';

import { useAppSelector } from '../app/hooks';
import { satisfiesPath } from '../model/constraints';
import { genUntilCondition } from '../model/generator';
import { BidPath } from '../model/system';
import { selectHandsSatisfyPath } from '../reducers/selection';
import { selectCompleteBidSubtree, selectSystemValid } from '../reducers/system';
import BidTreeView from './core/BidTree';
import HandView from './core/HandView';
import HandEditor from './HandEditor';

interface BidTreeSatisfiesViewProps {
  path: BidPath
}
const BidTreeSatisfiesView = ({ path }: BidTreeSatisfiesViewProps) => {
  const satisfies = useAppSelector(state =>
    selectHandsSatisfyPath({ state: state.selection, path }))
  return (
    <>{pipe(satisfies,
    option.match(
      () => "Incomplete",
      result => result
        ? "Yes"
        : "No"))}</>)
}

interface BidTreeHandSampleViewProps {
  path: BidPath
  limit: number
}
const BidTreeHandSampleView = ({ path, limit }: BidTreeHandSampleViewProps) => {
  const gen = 
    genUntilCondition(option.some(limit))(hands =>
      satisfiesPath(...hands)(path))
  return (
    <>{pipe(gen,
    option.matchW(
      () => "Effort level too low",
      ([opener, responder]) => <HandView hand={path.length % 2 === 1 ? opener : responder} />))
    }</>)
}

const TestHands = () => {
  const valid = useAppSelector(state => selectSystemValid({ state: state.system, options: state.settings }))
  const bidPathTree = useAppSelector(state => selectCompleteBidSubtree({ state: state.system, options: state.settings }))
  const effortLimit = useAppSelector(state => state.settings.effortLimit)
  
  return (
    <section>
      <h3>Test Hands</h3>
      <HandEditor />
      <h4>Valid System?</h4>
      {valid.toString()}
      <h4>Satisfies</h4>
      <BidTreeView tree={bidPathTree}>
        {path => <BidTreeSatisfiesView path={path} />}
      </BidTreeView>
      <h4>Samples</h4>
      <BidTreeView tree={bidPathTree}>
        {path => <BidTreeHandSampleView path={path} limit={effortLimit} />}
      </BidTreeView>
    </section>
  )
}

export default TestHands