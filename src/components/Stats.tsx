export {}
// import { either, option, readonlyNonEmptyArray, these } from 'fp-ts';
// import { constNull, pipe } from 'fp-ts/lib/function';
// import { UuidLike } from 'uuid-tool';

// import { useAppDispatch, useAppSelector } from '../app/hooks';
// import { serializedBidPathL } from '../model/serialization';
// import { average, getStats, stdev } from '../model/stats';
// import { Path } from '../model/system';
// import { ConstrainedBid } from '../model/system/core';
// import { getSatisfies, selectProgress, selectResultsByPath, selectSatisfyCountByJobIdAndPath, start } from '../reducers/generator';
// import { selectAllCompleteBidPaths } from '../reducers/system';
// import BidPath from './core/BidPath';
// import { DoubleDummyTableView } from './core/DoubleDummyResultView';

// interface StatsPathProps {
//   path: Path<ConstrainedBid>
//   collectionId: UuidLike
// }
// const StatsPath = ({ path, collectionId }: StatsPathProps) => {
//   const dispatch = useAppDispatch()
//   const sPath = pipe(path,
//     readonlyNonEmptyArray.map(p => p.bid),
//     serializedBidPathL.get)
//   const count = useAppSelector(state => selectSatisfyCountByJobIdAndPath({ state: state.generator, path: sPath, collectionId }))
//   const dds = useAppSelector(state => pipe(
//     path,
//     readonlyNonEmptyArray.map(p => p.bid),
//     serializedBidPathL.get,
//     path => selectResultsByPath({ state: state.generator, path })))
//   const stats = dds && getStats(pipe(dds, readonlyNonEmptyArray.map(d => d.results)))
//   const averages = stats && average(stats)
//   const stdevs = stats && stdev(stats)
//   return (
//     <>
//       <BidPath path={path.map(cb => cb.bid)} />
//       : &nbsp;
//       <span>{count !== null && <>{count.toString()}</>}</span>
//       {averages !== null && <section>
//         <h4>Average</h4>
//         {averages !== null && <DoubleDummyTableView table={averages} />}
//       </section>}
//       {stdevs !== null && <section>
//         <h4>Std. Dev.</h4>
//         <DoubleDummyTableView table={stdevs} />
//       </section>}
//       {/* {dds === null && <button onClick={e => dispatch(getResults({ path: path, deals: result.deals }))}>DDS</button>} */}
//       {/* {dds === null
//         ? <button onClick={e => dispatch(getResults({ path: result.path, deals: result.deals }))}>DDS</button>
//         : <ul>{dds.map((ddr, i) => <li  key={i}><DoubleDummyResultView result={ddr} /></li>)}</ul>} */}
//     </>)
// }

// const SatisfyStats = () => {
//   const dispatch = useAppDispatch()
//   const paths = useAppSelector(state => pipe(
//     selectAllCompleteBidPaths({ state: state.system, options: state.settings }),
//     these.getRight,
//     option.chain(readonlyNonEmptyArray.fromReadonlyArray),
//     option.toNullable))
//   const satisfiesNotRan = useAppSelector(state => state.generator.satisfies[1] === 0)
//   const collectionId = useAppSelector(state => pipe(state.generator.collections[0], either.getOrElseW(constNull)))
//   return (
//     <>
//       {collectionId !== null && paths !== null && <>
//         {satisfiesNotRan && <button onClick={e => dispatch(getSatisfies({ paths, collectionId }))}>Satisfies</button>}
//         {!satisfiesNotRan && <div>
//           <h3>Results</h3>
//           <ul>
//             {paths.map((path, i) => <li key={i}><StatsPath path={path} collectionId={collectionId} /></li>)}
//           </ul>
//         </div>}
//       </>}
//     </>
//   )
// }

// const Progress = () => {
//   const progress = useAppSelector(state => selectProgress(state.generator))
//   return <div>
//     <p>Deals: {progress.deals} remaining</p>
//     <p>Satisfies: {progress.satisfies} remaining</p>
//     <p>Results: {progress.results} remaining</p>
//   </div>
// }

// const Stats = () => {
//   const generating = useAppSelector(state => pipe(state.generator.working))
//   const count = useAppSelector(state => state.settings.generateCount)
//   const dispatch = useAppDispatch()
//   const rules = useAppSelector(state => selectAllCompleteBidPaths({ state: state.system, options: state.settings }))
//   const showGenerate = !these.isLeft(rules)
//   return (
//     <section>
//       <h3>Stats</h3>
//       {showGenerate && <div>
//         <button type="button" onClick={() => dispatch(start(count))}>Generate deals</button>
//         {generating ? <span>Generating...</span> : <span>Ready!</span>}
//         {generating && <Progress />}
//         {!generating && <SatisfyStats />}
//       </div>}
//     </section>
//   )
// }

// export default Stats