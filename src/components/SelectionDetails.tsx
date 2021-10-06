import { selectNodeByKey, selectPathByKey } from "../reducers/system"

import { option } from "fp-ts"
import { pipe } from "fp-ts/lib/function"
import { selectHandsSatisfySelectedPath } from "../reducers"
import { useAppSelector } from "../app/hooks"

const SelectionDetails = () => {
  const selected = useAppSelector(state => state.selection.selectedBlockKey)

  const path = useAppSelector(state => pipe(selected, option.map(s => selectPathByKey(state.system, s)), option.toNullable))
  const bid = useAppSelector(state => pipe(selected,
    option.chain(s => pipe(selectNodeByKey(state.system, s), option.fromNullable)),
    option.chain(n => n.bid),
    option.chain(option.fromEither),
    option.toNullable))
  const satisfies = useAppSelector(selectHandsSatisfySelectedPath)

  return (
    <section>
      <h3>Selection</h3>

      {path && <div>
        <h4>Selected Path</h4>
        {path.map(x => x.text).join(" > ")}
      </div>}

      {bid && <div>
        <h4>Selected Bid</h4>
        {pipe(bid, option.fromNullable, option.map(JSON.stringify), option.toNullable)}
        {satisfies !== null && <div>
        <h4>Satisfies</h4>
        {satisfies.toString()}
      </div>}
      </div>}
    </section>
  )
}

export default SelectionDetails