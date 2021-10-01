import { either, option } from "fp-ts"
import { selectErrors, selectNode, selectPath } from "../reducers/system"
import { selectTestConstraint, setTestHand } from "../reducers/selection"
import { useAppDispatch, useAppSelector } from "../app/hooks"
import { useCallback, useState } from "react"

import { draw } from "io-ts/lib/Decoder"
import { pipe } from "fp-ts/lib/function"

const SelectionDetails = () => {
  const selected = useAppSelector(state => state.selection.selectedBlockKey)

  const path = useAppSelector(state => pipe(selected, option.map(s => selectPath(state.system, s)), option.toNullable))
  const bid = useAppSelector(state => pipe(selected,
    option.chain(s => pipe(selectNode(state.system, s), option.fromNullable)),
    option.chain(n => pipe(n.bid, option.fromEither)),
    option.toNullable))
  // const rules = useAppSelector(state => selectRules(state.system))
  const testHand = useAppSelector(state => state.selection.testHand)
  const errors = useAppSelector(state => selectErrors(state.system))
  const satisfies = useAppSelector(state => pipe(bid, option.fromNullable, option.map(b => selectTestConstraint(state.selection, b.constraint))))

  const dispatch = useAppDispatch()
  const [hand, setHand] = useState<string>("")
  const onSetHand = useCallback((hand: string) => {
    setHand(hand)
    dispatch(setTestHand(hand))
  }, [dispatch])

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
      </section>}

      {bid && <section>
        <h3>Test Hands</h3>
        <input type="text" placeholder="AKQJ.T987.654.32" value={hand} onChange={e => onSetHand(e.target.value)} />
        {pipe(testHand, either.fold(
          err => <span>{draw(err)}</span>,
          hand => <div>
            <h4>Hand</h4>
            <ul>
              <li>{Array.from(hand).map(c => JSON.stringify(c))}</li>
            </ul>
            <h4>Satisfies?</h4>
            {satisfies._tag === "Some" && <span>{satisfies.value.toString()}</span>}
            </div>))}
      </section>}
    </div>
  )
}

export default SelectionDetails