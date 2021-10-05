import { option } from "fp-ts"
import { pipe } from "fp-ts/lib/function"
import { draw } from "io-ts/lib/Decoder"
import { useAppSelector } from "../app/hooks"
import { selectHandsSatisfySelectedPath, selectPathsSatisfyHands } from "../reducers"
import { selectErrors, selectNodeByKey, selectPathByKey } from "../reducers/system"
import BidPath from "./core/BidPath"
import HandEditor from "./HandEditor"

const SelectionDetails = () => {
  const selected = useAppSelector(state => state.selection.selectedBlockKey)

  const path = useAppSelector(state => pipe(selected, option.map(s => selectPathByKey(state.system, s)), option.toNullable))
  const bid = useAppSelector(state => pipe(selected,
    option.chain(s => pipe(selectNodeByKey(state.system, s), option.fromNullable)),
    option.chain(n => n.bid),
    option.chain(option.fromEither),
    option.toNullable))
  const errors = useAppSelector(state => selectErrors(state.system))
  const satisfies = useAppSelector(selectHandsSatisfySelectedPath)
  const results = useAppSelector(selectPathsSatisfyHands)

  return (
    <div>
      {errors.length > 0 && <section>
        <h3>Errors</h3>
        <ul>{errors.map((e, i) => <li key={i}>{draw(e)}</li>)}</ul>
        </section>}

      {path && <section>
        <h3>Selected Path</h3>
        {path.map(x => x.text).join(" > ")}
      </section>}

      {bid && <section>
        <h3>Selected Bid</h3>
        {pipe(bid, option.fromNullable, option.map(JSON.stringify), option.toNullable)}
        {satisfies !== null && <section>
        <h4>Satisfies</h4>
        {satisfies.toString()}
      </section>}
      </section>}

      <section>
        <h3>Test Hands</h3>
        <HandEditor />
      </section>

      {results !== null && <section>
        <h3>Results</h3>
        <ul>
          {results.map((r, i) => <li key={i}>
            <BidPath path={r.path} />
            : &nbsp;
            <span>{r.result.toString()}</span>
          </li>)}
        </ul>
      </section>}
    </div>
  )
}

export default SelectionDetails