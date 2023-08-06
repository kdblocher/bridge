import {
  option as O,
  readonlyRecord as RR,
  readonlyNonEmptyArray as RNEA,
} from "fp-ts";
import { flow, pipe } from "fp-ts/lib/function";
import { get } from "../../lib/object";
import { Generation } from "../../model/job";
import {
  SerializedBidPath,
  serializedBidPathL,
} from "../../model/serialization";
import SolutionStats from "./SolutionStats";
import ScoreComparison from "./ScoreComparison";
import { ContractBid } from "../../model/bridge";
import styled from "styled-components";

export const Columns = styled.div`
  display: flex;
  flex-direction: row;
`;

export const Column = styled.div`
  width: 35%;
`;

interface StatsDetailsProps {
  path: SerializedBidPath;
  generation: Generation;
  onClose: () => void;
}
const StatsDetails = ({ path, generation, onClose }: StatsDetailsProps) => {
  const stats = pipe(
    generation,
    O.fromNullable,
    O.chain(flow(get("solutionStats"), RR.lookup(path))),
    O.toNullable
  );
  const solveCount = pipe(
    stats,
    O.fromNullable,
    O.map(get("count")),
    O.chain(O.fromPredicate((len) => len > 0)),
    O.toNullable
  );
  const contractBid = pipe(
    path,
    serializedBidPathL.reverseGet,
    RNEA.last
  ) as ContractBid;
  return (
    <div>
      {solveCount && <h3>{solveCount} solutions found</h3>}
      <Columns>
        <Column>{stats && <SolutionStats stats={stats} />}</Column>
        <div>
          {stats?.scores && (
            <ScoreComparison contractBid={contractBid} scores={stats.scores} />
          )}
        </div>
      </Columns>
    </div>
  );
};

export default StatsDetails;
