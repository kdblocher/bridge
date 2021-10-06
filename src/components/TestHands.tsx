import BidPath from "./core/BidPath"
import HandEditor from "./HandEditor"
import { selectPathsSatisfyHands } from "../reducers"
import { useAppSelector } from "../app/hooks"

const TestHands = () => {
  const results = useAppSelector(selectPathsSatisfyHands)
  
  return (
    <section>
      <h3>Test Hands</h3>
      <HandEditor />

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