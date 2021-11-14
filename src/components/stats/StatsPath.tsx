
import { SerializedBidPath, serializedBidPathL } from '../../model/serialization';
import BidPath from '../core/BidPath';
import Fractional from '../core/Fractional';
import Percentage from '../core/Percentage';

interface StatsPathProps {
  path: SerializedBidPath
  satisfiesCount: number
  dealCount?: number
}
const StatsPath = ({ path, satisfiesCount, dealCount }: StatsPathProps) => {
  // const sPath = pipe(path,
  //   readonlyNonEmptyArray.map(p => p.bid),
  //   serializedBidPathL.get)
  // const dds = useAppSelector(state => pipe(
  //   path,
  //   readonlyNonEmptyArray.map(p => p.bid),
  //   serializedBidPathL.get,
  //   path => selectResultsByPath({ state: state.generator, path })))
  // const stats = dds && getStats(pipe(dds, readonlyNonEmptyArray.map(d => d.results)))
  // const averages = stats && average(stats)
  // const stdevs = stats && stdev(stats)
  return (
    <>
      <BidPath path={serializedBidPathL.reverseGet(path)} />
      <span>
        {satisfiesCount}
        {dealCount && <small>
          &nbsp;(
          <Percentage numerator={satisfiesCount} denominator={dealCount} decimalPlaces={2} />
          &nbsp;,&nbsp;or&nbsp;
          <Fractional numerator={satisfiesCount} denominator={dealCount} />
          )
        </small>}
      </span>
      {/* {averages !== null && <section>
        <h4>Average</h4>
        {averages !== null && <DoubleDummyTableView table={averages} />}
      </section>}
      {stdevs !== null && <section>
        <h4>Std. Dev.</h4>
        <DoubleDummyTableView table={stdevs} />
      </section>} */}
      {/* {dds === null && <button onClick={e => dispatch(getResults({ path: path, deals: result.deals }))}>DDS</button>} */}
      {/* {dds === null
        ? <button onClick={e => dispatch(getResults({ path: result.path, deals: result.deals }))}>DDS</button>
        : <ul>{dds.map((ddr, i) => <li  key={i}><DoubleDummyResultView result={ddr} /></li>)}</ul>} */}
    </>)
}

export default StatsPath