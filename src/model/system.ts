import { eq, option as O, readonlyArray as RA, readonlyNonEmptyArray as RNEA, tree as T } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';

import { ConstrainedBid, Constraint } from '../model/constraints';
import { Bid, eqBid } from './bridge';

export type Path<A> = RNEA.ReadonlyNonEmptyArray<A>
export type Paths<A> = RNEA.ReadonlyNonEmptyArray<Path<A>>
export type Forest<A> = ReadonlyArray<T.Tree<A>>

export const getPathUpTo = <A>(eqA: eq.Eq<A>) => (item: A) =>
  RA.findFirstMap(
    T.fold((a: A, paths: ReadonlyArray<O.Option<RNEA.ReadonlyNonEmptyArray<A>>>) : O.Option<RNEA.ReadonlyNonEmptyArray<A>> =>
      eqA.equals(a, item)
      ? O.some([item])
      : pipe(paths,
          RA.findFirstMap(O.map(RA.prepend(a))))))

export const flatten = <A>(forest: Forest<A>) =>
  pipe(forest,
    RA.chain(
      T.reduce<A, ReadonlyArray<A>>([], (items, a) =>
        pipe(items, RA.append(a)))))

export const pathTree = <A>(forest: Forest<A>) : Forest<Path<A>> =>
  pipe(forest,
    RA.map(flow(
      T.map(RNEA.of),
      T.fold((a, forest: ReadonlyArray<T.Tree<Path<A>>>) =>
        T.make(a, pipe(forest,
          RA.map(T.map(path => RNEA.concat(path)(a))), RA.toArray))))))

export const getAllLeafPaths = <A>(forest: Forest<A>): ReadonlyArray<Path<A>> =>
  pipe(forest,
    RA.chain(
      T.fold((node: A, paths: ReadonlyArray<Paths<A>>): Paths<A> =>
        pipe(paths,
          RNEA.fromReadonlyArray,
          O.fold(() => [[node]],
            RNEA.foldMap(RNEA.getSemigroup<Path<A>>())(RNEA.map(RA.prepend(node))))))),
    RA.filterMap(RNEA.fromReadonlyArray))

const extendWithSiblingsInternal = <T>(eq: eq.Eq<T>) => (siblings: ReadonlyArray<T>) => (t: T.Tree<T>) : T.Tree<T & { siblings: ReadonlyArray<T> }> =>
  T.make(
    ({ ...t.value, siblings }),
    pipe(t.forest, RA.map(
      pipe(t.forest,
        RA.map(t => t.value),
        RA.difference(eq)([t.value]), // end null hack
        extendWithSiblingsInternal(eq))),
      RA.toArray))

const extendWithSiblings = <A>(eq: eq.Eq<A>) =>
  RA.map(extendWithSiblingsInternal(eq)([]))

export interface BidInfo {
  bid: Bid
  siblings: ReadonlyArray<ConstrainedBid>
  constraint: Constraint
}
export type BidPath = Path<BidInfo>
export type BidPaths = Paths<BidInfo>
export type BidTree = Forest<BidInfo>

export const getBidInfo : (f: Forest<ConstrainedBid>) => Forest<BidInfo> =
  extendWithSiblings(eq.contramap<Bid, ConstrainedBid>(c => c.bid)(eqBid))

export const withImplicitPasses =
  RA.map(
    T.fold((a: ConstrainedBid, bs: T.Forest<ConstrainedBid>) =>
      bs.length === 0 || pipe(bs, RA.exists(t => t.value.bid === "Pass"))
      ? T.make(a, bs)
      : T.make(a, pipe(bs,
        RA.append(T.make<ConstrainedBid>({ bid: "Pass", constraint: { type: "Otherwise" }})),
        RA.toArray))))
