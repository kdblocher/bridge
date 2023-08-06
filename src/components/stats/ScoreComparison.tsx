import { ContractBid, Direction, eqContractBid, ordContractBid } from "../../model/bridge";
import { readonlyArray as RA, readonlyNonEmptyArray as RNEA } from "fp-ts";
import { Scores, compareScores } from "../../model/stats"
import Percentage from "../core/Percentage";
import BidSelector from "../core/BidSelector";
import { useCallback, useMemo, useState } from "react";
import { pipe } from "fp-ts/lib/function";
import styled from "styled-components";
import { BidView } from "../core/BidPath";
import { serializedBidL } from "../../model/serialization";

interface ScoreComparisonProps {
  contractBid: ContractBid
  scores: Scores
}
const defaultDir : Direction = "N"

export const Columns = styled.div `
  display: flex;
  flex-direction: row;
`

export const Column = styled.div `
  width: 35%;
`

export const ScoreList = styled.ul `
  list-style-type: none;
`

const ScoreComparison = ({ contractBid, scores }: ScoreComparisonProps) => {
  const [bids, setBids] = useState<RNEA.ReadonlyNonEmptyArray<ContractBid>>([contractBid])
  const setSelectedBid = useCallback((bid: ContractBid, selected: boolean) =>
    setBids(pipe(
      bids,
      selected ? RA.union(eqContractBid)([bid]) : RA.filter(b => !eqContractBid.equals(bid, b)),
      RA.append(contractBid),
      RNEA.uniq(eqContractBid),
      RNEA.sort(ordContractBid)))
  , [bids, contractBid])
  const comparison = useMemo(() => compareScores(scores)(pipe(bids, RNEA.map(b => ([defaultDir, b])))), [bids, scores])
  const length = scores.length
  return (<section>
    <h4>Compare Contracts</h4>
    <Columns>
      <BidSelector bids={bids} setSelectedBid={setSelectedBid} />
      <ScoreList>{length && Object.entries(comparison).map(([contract, count], i) =>
        <li key={i}>
          {contract === "tie" ? "(ties)" : <BidView bid={serializedBidL.reverseGet(contract)} />}
          : {count} (<Percentage numerator={count} denominator={length} />)
        </li>)}
      </ScoreList>
    </Columns>
  </section>)
}

export default ScoreComparison