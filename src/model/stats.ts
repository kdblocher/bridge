import * as aq from "arquero";
import {
  option as O,
  readonlyArray as RA,
  readonlyNonEmptyArray as RNEA,
  readonlyRecord as RR,
  readonlyTuple,
  semigroup,
} from "fp-ts";
import { sequenceT } from "fp-ts/lib/Apply";
import { flow, pipe } from "fp-ts/lib/function";
import * as iso from "monocle-ts/Iso";

import { DoubleDummyTable } from "../workers/dds.worker";
import { flattenNestedCounts } from "./analyze";
import { Direction, directions, Strain, strains } from "./bridge";

const SerializedKeyL: iso.Iso<readonly [Direction, Strain], string> = iso.iso(
  ([d, s]) => d + s,
  (s) => [s.charAt(0) as Direction, s.charAt(1) as Strain] as const
);

const columns = pipe(
  sequenceT(RNEA.Apply)(directions, strains),
  RNEA.map(SerializedKeyL.get)
);

const aggregate =
  (f: (field: any) => number) =>
  (table: aq.internal.ColumnTable): DoubleDummyTable =>
    pipe(
      columns,
      RNEA.groupBy((c) => c),
      RR.map((c) => f(c)),
      (x) => table.rollup(x),
      (table) => table.object() as RR.ReadonlyRecord<string, number>,
      RR.toReadonlyArray,
      RA.map(readonlyTuple.mapFst(SerializedKeyL.reverseGet)),
      RNEA.fromReadonlyArray,
      O.fold(
        () => ({}),
        flow(
          RNEA.groupBy(([[_, strain], __]) => strain),
          RR.map(
            flow(
              RNEA.groupBy(([[direction, _], __]) => direction),
              RR.map(flow(RNEA.head, ([_, agg]) => agg))
            )
          )
        )
      )
    );

const toRow = (ddt: DoubleDummyTable) =>
  pipe(
    ddt,
    flattenNestedCounts,
    RA.map(
      ({ outerKey: direction, innerKey: strain, value: count }) =>
        [`${direction}${strain}`, count] as const
    ),
    RR.fromFoldable(semigroup.first<number>(), RA.Foldable)
  );

export interface Stats {
  count: number;
  average: DoubleDummyTable;
  stdev: DoubleDummyTable;
}
export const getStats = flow(
  RNEA.map(toRow),
  aq.from,
  (ct): Stats => ({
    count: ct.totalRows(),
    average: pipe(ct, aggregate(aq.op.mean)),
    stdev: pipe(ct, aggregate(aq.op.stdev)),
  })
);
