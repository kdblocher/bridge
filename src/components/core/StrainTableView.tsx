import styled from 'styled-components';
import { readonlyRecord as RR } from 'fp-ts';
import { Strain, strains } from '../../model/bridge';

const suitBase = `
  &.S::before { content: "♠"; color: #0000FF }
  &.H::before { content: "♥"; color: #FF0000 }
  &.D::before { content: "♦"; color: #FFA500 }
  &.C::before { content: "♣"; color: #32CD32 }
`

export const StrainSpan = styled.span `
  ${suitBase}
  &.N::before { content: "NT"; color: #000000; font-size: 12px; }
`

type StrainRow<T> = RR.ReadonlyRecord<Strain, T>
export interface StrainTable<T> {
  rows: ReadonlyArray<StrainRow<T>>
}

interface StrainTableProps<T> {
  table: StrainTable<T>
  renderColHeader: ((strain: Strain, index: number) => JSX.Element | undefined)
  renderRowHeader: (row: StrainRow<T>, index: number) => JSX.Element | undefined
  renderCell: (value: T, strain: Strain, rowIndex: number) => JSX.Element | undefined
}

export const StrainTableView = <T extends any>({ table, renderColHeader, renderRowHeader, renderCell }: StrainTableProps<T>) => {
  return (
    <table>
      <thead>
        <tr>
          <th></th>
          {strains.map((s, i) => renderColHeader ? renderColHeader(s, i) : <th style={{fontWeight: "normal", verticalAlign: "middle"}} key={i}><StrainSpan className={s} /></th>)}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((r, i) => <tr key={i}>
          <td>{renderRowHeader(r, i)}</td>
          {strains.map((s, j) => <td key={j}>{renderCell(r[s], s, i)}</td>)}
        </tr>)}
      </tbody>
    </table>
  )
}

export default StrainTableView