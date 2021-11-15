import { Stats } from '../../model/stats';
import { DoubleDummyTableView } from '../core/DoubleDummyResultView';

interface SolutionStatsProps {
  stats: Stats
}
const SolutionStats = ({ stats }: SolutionStatsProps) => {
  return (
    <div>
      <span>{stats.count !== null && <>{stats.count.toString()}</>}</span>
      {stats.average !== null && <section>
        <h4>Average</h4>
        {stats.average !== null && <DoubleDummyTableView table={stats.average} />}
      </section>}
      {stats.stdev !== null && <section>
        <h4>Std. Dev.</h4>
        <DoubleDummyTableView table={stats.stdev} />
      </section>}
    </div>)
}

export default SolutionStats