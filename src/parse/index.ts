import { either, option, readonlyNonEmptyArray } from "fp-ts";
import { constant, flow, pipe } from "fp-ts/lib/function";
import * as d from 'io-ts/Decoder';
import * as DE from 'io-ts/lib/DecodeError';
import * as FS from 'io-ts/lib/FreeSemigroup';
import { bidFromAST, parseBid } from './bid';
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

const convertErrors = (errs: ReadonlyArray<SyntaxErr>): d.DecodeError =>
  pipe(errs,
    readonlyNonEmptyArray.fromReadonlyArray,
    option.fold(constant(d.error(null, "No syntax errors reported")),
      readonlyNonEmptyArray.foldMapWithIndex(FS.getSemigroup<DE.DecodeError<string>>())((i, err) =>
        FS.of(DE.index(i, "required",
          FS.of(DE.leaf({
            pos: err.pos,
            expmatches: err.expmatches
          }, err.toString())))))))

const parseResultToEither = <T>(result: ParseResult<T>) =>
  either.fromNullable(result.errs)(result.ast)

const getDecoder = <T>(parser: (input: string) => ParseResult<T>) : d.Decoder<string, T> =>
  pipe(
    d.string,
    d.parse(flow(parser, parseResultToEither, either.mapLeft(convertErrors))))

export const decodeBid = flow(
  getDecoder(parseBid).decode,
  either.map(x => bidFromAST(x.spec)))

export const decodeHand = flow(
  getDecoder(parseHand).decode,
  either.map(x => handFromAST(x.hand)))