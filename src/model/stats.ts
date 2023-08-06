import * as aq from "arquero";
import {
  option as O,
  readonlyArray as RA,
  readonlyNonEmptyArray as RNEA,
  readonlyRecord as RR,
  readonlyTuple,
  semigroup as S,
  ord,
  number,
  tuple,
} from "fp-ts";
import { sequenceT } from "fp-ts/lib/Apply";
import { flow, pipe } from "fp-ts/lib/function";
import * as iso from "monocle-ts/Iso";

import { DoubleDummyTable } from "../workers/dds.worker";
import {
  ContractScorePair,
  OptimalBid,
  eqOptimalBid,
  flattenNestedCounts,
  getAllScores,
  transpose,
} from "./analyze";
import { Direction, directions, Strain, strains } from "./bridge";
import { Score, eqScore } from "./score";
import { serializedContractBidL } from "./serialization";

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
    RR.fromFoldable(S.first<number>(), RA.Foldable)
  );

export type Scores = RNEA.ReadonlyNonEmptyArray<
  RR.ReadonlyRecord<Direction, ReadonlyArray<ContractScorePair>>
>;

export const getScores = (
  ddt: RNEA.ReadonlyNonEmptyArray<DoubleDummyTable>
): Scores =>
  pipe(
    ddt,
    RNEA.map(flow(transpose, getAllScores("Neither")))
    // aq.from,
    // ct => ct.count(),
    // ct => ct.object() as RR.ReadonlyRecord<string, number>
  );

type BidScorePair = readonly [string, Score];
export type ScoreCompare = RR.ReadonlyRecord<string, number> | { tie: number };

const ordScore: ord.Ord<Score> = ord.reverse(
  ord.fromCompare((a, b) => number.Ord.compare(a, b))
);
const ordScores: ord.Ord<BidScorePair> = pipe(
  ordScore,
  ord.contramap(([_, score]) => score)
);

const tallyScore = (results: ReadonlyArray<BidScorePair>): ScoreCompare => {
  const orderedScores = pipe(results, RA.sort(ordScores), (x) => x);
  if (
    !orderedScores.length ||
    (orderedScores.length > 1 &&
      eqScore.equals(orderedScores[0][1], orderedScores[1][1]))
  ) {
    return { tie: 1 };
  } else {
    return { [orderedScores[0][0]]: 1 };
  }
};
const sumCompare: S.Semigroup<ScoreCompare> = RR.getUnionSemigroup(
  number.SemigroupSum
);
const zeroCompare = (bids: RNEA.ReadonlyNonEmptyArray<string>): ScoreCompare =>
  pipe(
    bids,
    RNEA.map((b: string) => [b, 0] as const),
    RR.fromEntries
  );

const serializeOptimalBid = (bid: OptimalBid): string =>
  bid === "Pass" ? "Pass" : serializedContractBidL.get(bid);

export const compareScores =
  (scores: Scores) =>
  (dirsAndBids: RNEA.ReadonlyNonEmptyArray<[Direction, OptimalBid]>) =>
    pipe(
      scores,
      RNEA.map((score) =>
        pipe(
          dirsAndBids,
          RNEA.map(([dir, bid]) =>
            pipe(
              score[dir],
              RA.filter(([contract]) =>
                bid === "Pass"
                  ? contract === "Pass"
                  : eqOptimalBid.equals(bid, contract)
              ),
              RNEA.fromReadonlyArray,
              O.fold(
                () => ({}),
                RNEA.groupBy(([contract]) => serializeOptimalBid(contract))
              ),
              RR.map((x) => x[0]),
              RR.map(([_, score]) => score)
            )
          ),
          RNEA.map(RR.toReadonlyArray),
          RA.chain((x) => x),
          tallyScore
        )
      ),
      RNEA.foldMap(sumCompare)((x: ScoreCompare) => x),
      (s) =>
        sumCompare.concat(
          zeroCompare(
            pipe(dirsAndBids, RNEA.map(flow(tuple.snd, serializeOptimalBid)))
          ),
          s
        )
    );

export interface Stats {
  count: number;
  scores: Scores;
  average: DoubleDummyTable;
  stdev: DoubleDummyTable;
}

export const getStats = (ddt: RNEA.ReadonlyNonEmptyArray<DoubleDummyTable>) =>
  pipe(
    ddt,
    RNEA.map(toRow),
    aq.from,
    (ct): Stats => ({
      count: ct.totalRows(),
      scores: pipe(ddt, getScores),
      average: pipe(ct, aggregate(aq.op.mean)),
      stdev: pipe(ct, aggregate(aq.op.stdev)),
    })
  );
