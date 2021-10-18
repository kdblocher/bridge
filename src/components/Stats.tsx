import { option } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import { draw } from 'io-ts/lib/Decoder';
import { useState } from 'react';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { selectSatisfyStats } from '../reducers';
import { analyzeDeals } from '../reducers/generator';
import { selectAllCompleteBidPaths, selectErrors } from '../reducers/system';
import BidPath from './core/BidPath';

const Stats = () => {
  const generating = useAppSelector(state => pipe(state.generator.generating, option.toNullable))
  const dispatch = useAppDispatch()
  const rules = useAppSelector(state => selectAllCompleteBidPaths(state.system))
  const errors = useAppSelector(state => selectErrors(state.system))
  const showGenerate = rules !== null && rules.length > 0 && errors.length === 0
  const stats = useAppSelector(selectSatisfyStats)
  const [count, setCount] = useState<number>(20)
  return (
    <section>
      <h3>Stats</h3>
      {!showGenerate && <div>
        <p>Select the system and/or fix errors</p>
        {errors.length > 0 && <div>
          <h4>Errors</h4>
          <ul>{errors.map((e, i) => <li key={i}>{draw(e)}</li>)}</ul>
        </div>}
      </div>}
      {showGenerate && <div>
        <button type="button" onClick={() => dispatch(analyzeDeals(count))}>Generate deals</button>
        <input type="number" value={count} onChange={e => setCount(parseInt(e.target.value))} />
        {generating === null ? <span>Ready!</span> : <span>Generating... ({generating} deals left)</span>}
        {stats !== null && <div>
          <h3>Results</h3>
          <ul>
            {stats.map((r, i) => <li key={i}>
              <BidPath path={r.path} />
              : &nbsp;
              <span>{r.count.toString()}</span>
            </li>)}
          </ul>
        </div>}
      </div>}
    </section>
  )
}

export default Stats