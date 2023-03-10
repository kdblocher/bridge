import { option as O, readonlyRecord as RR } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import { get } from '../../lib/object';
import { Generation } from "../../model/job";
import { SerializedBidPath } from "../../model/serialization";
import SolutionStats from "./SolutionStats";

interface StatsDetailsProps {
  path: SerializedBidPath
  generation: Generation
  onClose: () => void
}
const StatsDetails = ({ path, generation, onClose }: StatsDetailsProps) => {
  const stats = pipe(
    generation,
    O.fromNullable,
    O.chain(flow(
      get('solutionStats'),
      RR.lookup(path))),
    O.toNullable)
  const solveCount = pipe(
    stats,
    O.fromNullable,
    O.map(get('count')),
    O.chain(O.fromPredicate(len => len > 0)),
    O.toNullable)
  return (<div>
    {solveCount && <h3>{solveCount} solutions found</h3>}
    {stats && <SolutionStats stats={stats} />}
  </div>)
}

export default StatsDetails