import { either, eq, hkt, option as O, readonlyArray as RA, readonlyNonEmptyArray as RNEA, tree as T } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import { Functor1 } from 'fp-ts/lib/Functor';

import { ConstrainedBid, Constraint } from '../model/constraints';
import { Bid } from './bridge';

export type Path<T> = RNEA.ReadonlyNonEmptyArray<T>
export type Paths<T> = RNEA.ReadonlyNonEmptyArray<Path<T>>

export const pathsWithoutRoot = <F extends hkt.URIS>(K: Functor1<F>) => <A, B>(f: (a: A, bs: ReadonlyArray<hkt.Kind<F, RNEA.ReadonlyNonEmptyArray<B>>>) => hkt.Kind<F, RNEA.ReadonlyNonEmptyArray<B>>) =>
  flow(T.fold(f),
    x => K.map(x, RNEA.tail))

// root node is fake, so descend one level and then reconstruct the tree
export const filterIncomplete = <E, A>(t: T.Tree<O.Option<either.Either<E, A>>>) =>
  pipe(
    t.forest,
    RA.map(T.traverse(O.Applicative)(O.chain(O.fromEither))),
    forest => T.make<A | null>(null, pipe(forest, RA.compact, RA.toArray))) as T.Tree<A> // null hack at root node

export const getAllLeafPaths = <T>(tree: T.Tree<T>) =>
  pipe(tree,
    pathsWithoutRoot(RNEA.Functor)((node: T, paths: ReadonlyArray<Paths<T>>) =>
      pipe(paths,
        RNEA.fromReadonlyArray,
        O.fold(() => [[node]],
          RNEA.foldMap(RNEA.getSemigroup<Path<T>>())(RNEA.map(RA.prepend(node)))))),
    RA.filterMap(RNEA.fromReadonlyArray))

export interface BidInfo {
  bid: Bid
  siblings: ReadonlyArray<ConstrainedBid>
  constraint: Constraint
}
export type BidPath = Path<BidInfo>
export type BidPaths = Paths<BidInfo>
export type BidTree = T.Tree<BidInfo>

const extendWithSiblingsInternal = <T>(eq: eq.Eq<T>) => (siblings: ReadonlyArray<T>) => (t: T.Tree<T>) : T.Tree<T & { siblings: ReadonlyArray<T> }> =>
  T.make(
    ({ ...t.value, siblings }),
    pipe(t.forest, RA.map(
      pipe(t.forest,
        RA.map(t => t.value),
        x => t.value === null ? x : RA.difference(eq)([t.value])(x), // end null hack
        extendWithSiblingsInternal(eq))),
      RA.toArray))

export const extendWithSiblings = <A>(eq: eq.Eq<A>) => extendWithSiblingsInternal(eq)([])

export const pathTree = <A>(t: T.Tree<A>) : T.Tree<Path<A>> =>
  pipe(t,
    T.map(RNEA.of),
    T.fold((a, forest: ReadonlyArray<T.Tree<Path<A>>>) =>
      T.make(a, pipe(forest,
        RA.map(T.map(path => RNEA.concat(path)(a))), RA.toArray))),
    T.map(x => RNEA.tail(x) as RNEA.ReadonlyNonEmptyArray<A>))