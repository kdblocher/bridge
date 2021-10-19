import * as aq from 'arquero';
import { option, readonlyArray, readonlyNonEmptyArray, readonlyRecord, readonlyTuple, semigroup } from 'fp-ts';
import { sequenceT } from 'fp-ts/lib/Apply';
import { flow, pipe } from 'fp-ts/lib/function';
import * as iso from 'monocle-ts/Iso';
import { DoubleDummyTable } from '../workers/dds.worker';
import { flattenNestedCounts } from './analyze';
import { Direction, directions, Strain, strains } from './bridge';


const SerializedKeyL : iso.Iso<readonly [Direction, Strain], string> = iso.iso(
  ([d, s]) => d + s,
  s => [s.charAt(0) as Direction, s.charAt(1) as Strain] as const
)

const columns =
  pipe(
    sequenceT(readonlyNonEmptyArray.Apply)(
      directions,
      strains),
    readonlyNonEmptyArray.map(SerializedKeyL.get))
    
const toRow = (ddt: DoubleDummyTable) =>
  pipe(ddt,
    flattenNestedCounts,
    readonlyArray.map(({ outerKey: direction, innerKey: strain, value: count }) => [`${direction}${strain}`, count] as const),
    readonlyRecord.fromFoldable(semigroup.first<number>(), readonlyArray.Foldable)
)
export const getStats = flow(
  readonlyArray.map(toRow),
  aq.from)

export const aggregate = (f: (field: any) => number) => (table: aq.internal.ColumnTable): DoubleDummyTable =>
  pipe(columns,
    readonlyNonEmptyArray.groupBy(c => c),
    readonlyRecord.map(c => f(c)),
    x => table.rollup(x),
    table => table.object() as readonlyRecord.ReadonlyRecord<string, number>,
    readonlyRecord.toReadonlyArray,
    readonlyArray.map(readonlyTuple.mapFst(SerializedKeyL.reverseGet)),
    readonlyNonEmptyArray.fromReadonlyArray,
    option.fold(() => ({}), flow(
      readonlyNonEmptyArray.groupBy(([[_, strain], __]) => strain),
      readonlyRecord.map(flow(
        readonlyNonEmptyArray.groupBy(([[direction, _], __]) => direction),
        readonlyRecord.map(flow(
          readonlyNonEmptyArray.head,
          ([_, agg]) => agg)))))))

export const average = aggregate(aq.op.mean)
export const stdev = aggregate(aq.op.stdev)