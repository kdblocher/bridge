import { readonlyNonEmptyArray } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import { draw } from 'io-ts/lib/Decoder';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { ContractBid } from '../model/bridge';
import { serializedBidPathL } from '../model/serialization';
import { average, getStats, stdev } from '../model/stats';
import { BidPathResult, selectSatisfyStats } from '../reducers';
import { generate, getResults, selectProgress, selectResultsByPath } from '../reducers/generator';
import { selectAllCompleteBidPaths, selectErrors } from '../reducers/system';
import BidPath from './core/BidPath';
import { DoubleDummyTableView } from './core/DoubleDummyResultView';


interface StatsPathProps {
  result: BidPathResult
}
const StatsPath = ({ result }: StatsPathProps) => {
  const dispatch = useAppDispatch()
  const dds = useAppSelector(state => selectResultsByPath(state.generator, pipe(result.path, readonlyNonEmptyArray.map(p => p.bid as ContractBid), serializedBidPathL.get)))
  const stats = dds && getStats(pipe(dds, readonlyNonEmptyArray.map(d => d.results)))
  const averages = stats && average(stats)
  const stdevs = stats && stdev(stats)
  return (
    <>
      <BidPath path={result.path} />
      : &nbsp;
      <span>{result.count.toString()}</span>
      {averages !== null && <section>
        <h4>Average</h4>
        {averages !== null && <DoubleDummyTableView table={averages} />}
      </section>}
      {stdevs !== null && <section>
        <h4>Std. Dev.</h4>
        <DoubleDummyTableView table={stdevs} />
      </section>}
      {dds === null && <button onClick={e => dispatch(getResults({ path: result.path, deals: result.deals }))}>DDS</button>}
      {/* {dds === null
        ? <button onClick={e => dispatch(getResults({ path: result.path, deals: result.deals }))}>DDS</button>
        : <ul>{dds.map((ddr, i) => <li  key={i}><DoubleDummyResultView result={ddr} /></li>)}</ul>} */}
    </>)
}

const SatisfyStats = () => {
  const stats = useAppSelector(selectSatisfyStats)
  return (
    <>
      {stats !== null && <div>
        <h3>Results</h3>
        <ul>
          {stats.map((result, i) => <li key={i}><StatsPath result={result} /></li>)}
        </ul>
      </div>}
    </>
  )
}

const Progress = () => {
  const progress = useAppSelector(state => selectProgress(state.generator))
  return <div>
    <p>Deals: {progress.deals} remaining</p>
    <p>Results: {progress.results} remaining</p>
  </div>
}

const Stats = () => {
  const generating = useAppSelector(state => pipe(state.generator.working))
  const dispatch = useAppDispatch()
  const rules = useAppSelector(state => selectAllCompleteBidPaths(state.system))
  const errors = useAppSelector(state => selectErrors(state.system))
  const showGenerate = rules !== null && rules.length > 0 && errors.length === 0
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
        <button type="button" onClick={() => dispatch(generate(count))}>Generate deals</button>
        <input type="number" value={count} onChange={e => setCount(parseInt(e.target.value))} />
        {generating ? <span>Generating...</span> : <span>Ready!</span>}
        {generating && <Progress />}
        {!generating && <SatisfyStats />}
      </div>}
    </section>
  )
}

export default Stats