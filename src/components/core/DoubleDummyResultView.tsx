import styled from 'styled-components';
import { directions, strains } from '../../model/bridge';
import { DoubleDummyResult } from '../../workers/dds.worker';


const suitBase = `
  &.S::before { content: "♠"; color: #0000FF }
  &.H::before { content: "♥"; color: #FF0000 }
  &.D::before { content: "♦"; color: #FFA500 }
  &.C::before { content: "♣"; color: #32CD32 }
`

const StrainSpan = styled.span `
  ${suitBase}
  &.N::before { content: "NT"; color: #000000; font-size: 12px; }
`

interface Props {
  result: DoubleDummyResult
}
const DoubleDummyResultView = ({ result }: Props) => {
  return (
    <table>
      <thead>
        <tr>
          <th></th>
          {strains.map((s, i) => <th style={{fontWeight: "normal", verticalAlign: "middle"}} key={i}><StrainSpan className={s} /></th>)}
        </tr>
      </thead>
      <tbody>
        {directions.map((d, i) => <tr key={i}>
          <td>{d}</td>
          {strains.map((s, i) => <td key={i}>{result.results[s][d]}</td>)}
          {/* <td><HandView hand={serializedDealL.reverseGet(result.deal)[d]} /></td> */}
        </tr>)}
      </tbody>
    </table>
  )
}

export default DoubleDummyResultView