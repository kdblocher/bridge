
import { useState } from "react"
import { useAppDispatch, useAppSelector } from "../app/hooks"
import { selectSatisfyStats } from "../reducers"
import { genDeals } from "../reducers/generator"
import BidPath from "./core/BidPath"

const Stats = () => {
  const generating = useAppSelector(state => state.generator.generating)
  const dispatch = useAppDispatch()
  const stats = useAppSelector(selectSatisfyStats)
  const [count, setCount] = useState<number>(10000)
  return (
    <section>
      <h3>Stats</h3>
      <button type="button" onClick={() => dispatch(genDeals(count))}>Generate deals</button>
      <input type="number" value={count} onChange={e => setCount(parseInt(e.target.value))} />
      {generating && <span>Generating...</span>}
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
    </section>
  )
}

export default Stats