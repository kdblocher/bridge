import { readonlyRecord as RR, readonlyArray as RA, } from "fp-ts"
import { ContractBid, eqContractBid, levels, strains } from "../../model/bridge"
import StrainTableView, { StrainSpan } from "./StrainTableView"
import { pipe } from "fp-ts/lib/function"
import { Button } from '@fluentui/react-components';

interface BidSelectorButtonProps {
  selected: boolean,
  children: JSX.Element
  setSelected: (selected: boolean) => void
}
const BidSelectorButton = ({ children, selected, setSelected }: BidSelectorButtonProps) =>
  <Button style={{minWidth: "50px", width: "50px"}} onClick={() => setSelected(!selected)} appearance={selected ? "primary" : "secondary"}>{children}</Button>

interface BidSelectorProps {
  bids: ReadonlyArray<ContractBid>,
  setSelectedBid: (bid: ContractBid, selected: boolean) => void 
}
export const BidSelector = ({ bids, setSelectedBid }: BidSelectorProps) => {
  const contractBidsEnabledByLevel =
    pipe(levels,
      RA.map(level => pipe(strains,
        RA.map(strain => ({ level, strain }) as ContractBid),
        RA.map(bid => [bid.strain, pipe(bids, RA.exists(selectedBid => eqContractBid.equals(bid, selectedBid)))] as const),
      RR.fromEntries)))
  return (<StrainTableView
    table={{rows: contractBidsEnabledByLevel}}
    renderColHeader={() => undefined}
    renderRowHeader={() => undefined}
    renderCell={(selected, s, i) =>
      <BidSelectorButton selected={selected} setSelected={selected => setSelectedBid({ level: i + 1, strain: s}, selected)}>
        <>{i + 1}<StrainSpan className={s} /></>
      </BidSelectorButton>}
    />)
}

export default BidSelector