export {}
// import { option } from 'fp-ts';
// import { pipe } from 'fp-ts/lib/function';
// import JSONPretty from 'react-json-pretty';

// import { useAppSelector } from '../app/hooks';
// import { selectHandsSatisfySelectedPath } from '../reducers';
// import { selectBidByKey } from '../reducers/system';

// const SelectionDetails = () => {
//   const selected = useAppSelector(state => state.selection.selectedBlockKey)
//   const bid = useAppSelector(state => pipe(selected,
//     option.chain(key => selectBidByKey({ state: state.system, key })),
//     option.toNullable))
//   const satisfies = useAppSelector(selectHandsSatisfySelectedPath)

//   return (
//     <section>
//       <h3>Selection</h3>
//       {bid && <div>
//         <h4>Selected Bid</h4>
//         <JSONPretty data={bid} />
//         {satisfies !== null && <div>
//         <h4>Satisfies</h4>
//         {satisfies.toString()}
//       </div>}
//       </div>}
//     </section>
//   )
// }

// export default SelectionDetails