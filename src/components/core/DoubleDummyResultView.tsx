import styled from 'styled-components';
import { directions, strains } from '../../model/bridge';
import { serializedDealL } from '../../model/serialization';
import { DoubleDummyResult, DoubleDummyTable } from '../../workers/dds.worker';
import HandView from './HandView';

const suitBase = `
  &.S::before { content: "♠"; color: #0000FF }
  &.H::before { content: "♥"; color: #FF0000 }
  &.D::before { content: "♦"; color: #FFA500 }
  &.C::before { content: "♣"; color: #32CD32 }
`
const StrainTH = styled.th `
  font-weight: normal;
  vertical-align: middle;
  font-size: 13pt;
  text-decoration: underline;
  padding: 0px 20px;
`
const StrainSpan = styled.span `
  ${suitBase}
  &.N::before { content: "NT"; color: #000000; font-size: 12px; }
`
interface DoubleDummyTableProps {
  table: DoubleDummyTable
}

export const DoubleDummyTableView = ({ table }: DoubleDummyTableProps) => {
  return (
    <table>
      <thead>
        <tr>
          <th></th>
          {strains.map((s, i) => <StrainTH key={i}> <StrainSpan className={s}/> </StrainTH>)}
        </tr>
      </thead>
      <tbody>
        {directions.map((d, i) => <tr key={i}>
          <td style={{paddingRight: "20px"}}>{d}</td>
          {strains.map((s, i) => 
            <td style={{verticalAlign: "middle", padding: "10px 0px 5px 10px"}} key={i}>{Math.round(table[s][d] * 100) / 100}</td>
          )}
        </tr>)}
      </tbody>
    </table>
  )
}

interface Props {
  result: DoubleDummyResult
}

const DoubleDummyResultView = ({ result }: Props) => {
  return (
    <table>
      <thead>
        <tr>
          <th></th>
          {strains.map((s, i) => <StrainTH key={i}> <StrainSpan className={s}/> </StrainTH>)}
        </tr>
      </thead>
      <tbody>
        {directions.map((d, i) => <tr key={i}>
          <td>{d}</td>
          {strains.map((s, i) => <td key={i}>{result.results[s][d]}</td>)}
          <td><HandView hand={serializedDealL.reverseGet(result.board.deal)[d]} /></td>
        </tr>)}
      </tbody>
    </table>
  )
}

export default DoubleDummyResultView