import { readonlyNonEmptyArray, these } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { serializedBidPathL } from '../model/serialization';
import { average, getStats, stdev } from '../model/stats';
import { BidPathResult, selectSatisfyStats } from '../reducers';
import { generate, getResults, selectProgress, selectResultsByPath } from '../reducers/generator';
import { selectAllCompleteBidPaths } from '../reducers/system';
import BidPath from './core/BidPath';
import { DoubleDummyTableView } from './core/DoubleDummyResultView';
import styled from 'styled-components';
import Settings from './Settings';

interface StatsPathProps {
  result: BidPathResult
}

const StatsPath = ({ result }: StatsPathProps) => { 
   const SectionFormat = styled.section `
  border: 1px grey solid;
  width: 300px;
  padding: 10px;
  margin: 10px 0px;
`
const SectionTitle = styled.h4 `
  margin: 0px;
  text-decoration: underline;
`
  const dispatch = useAppDispatch()
  const dds = useAppSelector(state => pipe(
    result.path,
    readonlyNonEmptyArray.map(p => p.bid),
    serializedBidPathL.get,
    path => selectResultsByPath({ state: state.generator, path })))
  const stats = dds && getStats(pipe(dds, readonlyNonEmptyArray.map(d => d.results)))
  const averages = stats && average(stats)
  const stdevs = stats && stdev(stats)

  const AverageResultBox = ({ result }: StatsPathProps) =>
    <>
      {averages !== null && <div><SectionFormat>
        <SectionTitle>Average</SectionTitle>
        {averages !== null && <DoubleDummyTableView table={averages} />}
      </SectionFormat>
      </div>}
    </>

  const StdDevResultBox = ({ result }: StatsPathProps) =>
    <>
      {stdevs !== null && <SectionFormat>
        <SectionTitle>Std. Dev.</SectionTitle>        
        <DoubleDummyTableView table={stdevs} />
      </SectionFormat>}
    </>

  return (
    <>
      {<button onClick={e => dispatch(getResults({ path: result.path, deals: result.deals }))}>DDS</button>}

      <BidPath path={result.path.map(cb => cb.bid)} />
      <span>{result.count.toString()}</span>
      <AverageResultBox result={result}></AverageResultBox>
      <StdDevResultBox result={result}></StdDevResultBox>
      <br />
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
  const count = useAppSelector(state => state.settings.generateCount)
  const dispatch = useAppDispatch()
  const rules = useAppSelector(state => selectAllCompleteBidPaths({ state: state.system, options: state.settings }))
  const showGenerate = !these.isLeft(rules)
  return (
    <section>
      <h3>Stats</h3>
      <Settings />

      {showGenerate && <div>
        <button type="button" onClick={() => dispatch(generate(count))}>Generate deals</button>
        {generating ? <span> Generating...</span> : <span> Ready!</span>}
        {generating && <Progress />}
        {!generating && <SatisfyStats />}
      </div>}
    </section>
  )
}

export default Stats