import { option } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';

import { useAppSelector } from '../app/hooks';
import { selectHandsSatisfySelectedPath } from '../reducers';
import { selectBidByKey, selectPathUpToKey } from '../reducers/system';

const SelectionDetails = () => {
  const selected = useAppSelector(state => state.selection.selectedBlockKey)

  const path = useAppSelector(state => pipe(selected,
    option.chain(key => selectPathUpToKey({ state: state.system, key })),
    option.toNullable))
  const bid = useAppSelector(state => pipe(selected,
    option.chain(key => selectBidByKey({ state: state.system, key })),
    option.toNullable))
  const satisfies = useAppSelector(selectHandsSatisfySelectedPath)

  return (
    <section>
      <h3>Selection</h3>

      {path && <div>
        <h4>Selected Path</h4>
        {path.map(x => x).join(" > ")}
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