import { either, option, readonlyArray, readonlyNonEmptyArray as RNEA } from 'fp-ts';
import { constant, flow, pipe } from 'fp-ts/lib/function';
import * as d from 'io-ts/Decoder';
import * as DE from 'io-ts/lib/DecodeError';
import * as FS from 'io-ts/lib/FreeSemigroup';

import { constrainedBidFromAST, parseBid } from './bid';
import { handFromAST, parseHand } from './hand';

export interface PosInfo {
  readonly overallPos: number;
  readonly line: number;
  readonly offset: number;
}
export interface RegexMatch {
  readonly kind: "RegexMatch";
  readonly negated: boolean;
  readonly literal: string;
}
export type EOFMatch = { kind: "EOF"; negated: boolean };
export type MatchAttempt = RegexMatch | EOFMatch;
interface SyntaxErr {
  pos: PosInfo;
  expmatches: MatchAttempt[];
  toString(): string
}
interface ParseResult<T> {
  ast: T | null;
  errs: SyntaxErr[];
}
// above is generalized from generated tsPEG code

const convertErrors = (errs: ReadonlyArray<readonly [string, SyntaxErr]>): d.DecodeError =>
  pipe(errs,
    RNEA.fromReadonlyArray,
    option.fold(constant(d.error(null, "No syntax errors reported")),
      RNEA.foldMap(FS.getSemigroup<DE.DecodeError<string>>())(([actual, err]) =>
        FS.of(DE.key(actual, "required",
          FS.of(DE.index(err.pos.offset, "required",
            pipe(err.expmatches,
              RNEA.fromReadonlyArray,
              option.fold(constant(FS.of(DE.leaf(actual, ""))),
                RNEA.foldMapWithIndex(FS.getSemigroup<DE.DecodeError<string>>())((i, x)=>
                  FS.of(DE.leaf(actual.substring(err.pos.offset), x.kind === "EOF" ? "EOF" : `${x.negated ? 'not ': ''}'${x.literal}'`))))))))))))

const parseResultToEither = <T>(result: ParseResult<T>) =>
  either.fromNullable(result.errs)(result.ast)

const getDecoder = <T>(parser: (input: string) => ParseResult<T>) : d.Decoder<string, T> =>
  pipe(
    d.string,
    d.parse(input => pipe(input,
      parser,
      parseResultToEither,
      either.mapLeft(flow(
        readonlyArray.map(x => [input, x] as const),
        convertErrors)))))

export const decodeBid = flow(
  getDecoder(parseBid).decode,
  either.map(x => constrainedBidFromAST(x.spec)))

export const decodeHand = flow(
  getDecoder(parseHand).decode,
  either.map(x => handFromAST(x.hand)))