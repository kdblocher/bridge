import { either } from 'fp-ts';
import { constTrue, identity, pipe } from 'fp-ts/lib/function';
import JSONPretty from 'react-json-pretty';

import { useAppSelector } from '../app/hooks';
import { selectPathsSatisfyHands } from '../reducers';
import { selectSystemValid } from '../reducers/system';
import BidPath from './core/BidPath';
import HandEditor from './HandEditor';

const TestHands = () => {
  const valid = useAppSelector(state => selectSystemValid({ state: state.system, options: state.settings }))
  const results = useAppSelector(selectPathsSatisfyHands)
  
  return (
    <section>
      <h3>Test Hands</h3>
      <HandEditor />
      {either.isLeft(valid) && <>
        <h4>Validation Error</h4>
        <JSONPretty data={pipe(valid, either.foldW(identity, identity))} />
      </>}
      {results !== null && <div>
        <h4>Results</h4>
        <ul>
          {results.map((r, i) => <li key={i}>
            <BidPath path={r.path} />
            : &nbsp;
            <span>{r.result.toString()}</span>
          </li>)}
        </ul>
      </div>}
    </section>
  )
}

export default TestHands