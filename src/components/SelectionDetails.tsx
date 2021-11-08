import { option, readonlyArray } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import JSONPretty from 'react-json-pretty';

import { useAppSelector } from '../app/hooks';
import { selectBidByKey, selectCompleteBidByKey, selectErrorsByKey } from '../reducers/system';
import { ErrorGrid } from './Errors';

const SelectionDetails = () => {
  const selected = useAppSelector(state => state.selection.selectedBlockKey)
  const syntacticBid = useAppSelector(state => pipe(selected,
    option.chain(key => selectBidByKey({ state: state.system, key })),
    option.toNullable))
  const constrainedBid = useAppSelector(state => pipe(selected,
    option.chain(key => selectCompleteBidByKey({ state: state.system, key })),
    option.toNullable))
  const errors = useAppSelector(state =>  pipe(selected,
    option.fold(() => readonlyArray.empty, key => selectErrorsByKey({ state: state.system, key }))))

  return (
    <section>
      {selected && <div>
        <h3>Selection</h3>
        {errors && <div>
          <h4>Errors</h4>
          <ErrorGrid errors={errors} />
        </div>}
        {syntacticBid && <div>
          <h4>Syntax</h4>
          <JSONPretty data={syntacticBid} />
        </div>}
        {constrainedBid && <div>
          <h4>Constraint</h4>
          <JSONPretty data={constrainedBid} />
        </div>}
      </div>}
    </section>
  )
}

export default SelectionDetails