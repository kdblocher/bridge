import { option } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';

import { useAppSelector } from '../app/hooks';
import { BidPath } from '../model/system';
import { selectPathsSatisfyHands } from '../reducers';
import { selectHandsSatisfyPath } from '../reducers/selection';
import { selectCompleteBidSubtree, selectSystemValid } from '../reducers/system';
import BidPathView from './core/BidPath';
import BidTreeView from './core/BidTree';
import HandEditor from './HandEditor';

interface BidTreeSatisfiesViewProps {
  path: BidPath
}
const BidTreeSatisfiesView = ({ path }: BidTreeSatisfiesViewProps) => {
  const satisfies = useAppSelector(state =>
    selectHandsSatisfyPath(state.selection, path))
  return (
    <>{pipe(satisfies,
    option.match(
      () => "Incomplete",
      result => result
        ? "Yes"
        : "No"))}</>)
}

const TestHands = () => {
  const valid = useAppSelector(state => selectSystemValid(state.system, state.settings))
  const results = useAppSelector(selectPathsSatisfyHands)
  const bidPathTree = useAppSelector(state => pipe(
    selectCompleteBidSubtree(state.system, state.settings)))
  
  return (
    <section>
      <h3>Test Hands</h3>
      <HandEditor />
      <h4>Valid System?</h4>
      {valid.toString()}
      {results !== null && <div>
        <h4>Results</h4>
        <BidTreeView tree={bidPathTree}>
          {path => <>: <BidTreeSatisfiesView path={path} /></>}
        </BidTreeView>
        <ul>
          {results.map((r, i) => <li key={i}>
            <BidPathView path={r.path} />
            : &nbsp;
            <span>{r.result.toString()}</span>
          </li>)}
        </ul>
      </div>}
    </section>
  )
}

export default TestHands