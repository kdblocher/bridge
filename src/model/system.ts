import { either, eq, hkt, option as O, readonlyArray as RA, readonlyNonEmptyArray as RNEA, tree } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import { Functor1 } from 'fp-ts/lib/Functor';

import { ConstrainedBid, Constraint } from '../model/constraints';
import { Bid } from './bridge';

export type Path<T> = RNEA.ReadonlyNonEmptyArray<T>
export type Paths<T> = RNEA.ReadonlyNonEmptyArray<Path<T>>

export const pathsWithoutRoot = <F extends hkt.URIS>(K: Functor1<F>) => <A, B>(f: (a: A, bs: ReadonlyArray<hkt.Kind<F, RNEA.ReadonlyNonEmptyArray<B>>>) => hkt.Kind<F, RNEA.ReadonlyNonEmptyArray<B>>) =>
  flow(tree.fold(f),
    x => K.map(x, RNEA.tail))

// root node is fake, so descend one level and then reconstruct the tree
export const filterIncomplete = <E, A>(t: tree.Tree<O.Option<either.Either<E, A>>>) =>
  pipe(
    t.forest,
    RA.map(tree.traverse(O.Applicative)(O.chain(O.fromEither))),
    forest => tree.make<A | null>(null, pipe(forest, RA.compact, RA.toArray))) as tree.Tree<A> // null hack at root node

export const getAllLeafPaths = <T>(tree: tree.Tree<T>) =>
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
export type BidTree = tree.Tree<BidInfo>

const extendWithSiblingsInternal = <T>(eq: eq.Eq<T>) => (siblings: ReadonlyArray<T>) => (t: tree.Tree<T>) : tree.Tree<T & { siblings: ReadonlyArray<T> }> =>
  tree.make(
    ({ ...t.value, siblings }),
    pipe(t.forest, RA.map(
      pipe(t.forest,
        RA.map(t => t.value),
        x => t.value === null ? x : RA.difference(eq)([t.value])(x), // end null hack
        extendWithSiblingsInternal(eq))),
      RA.toArray))

export const extendWithSiblings = <T>(eq: eq.Eq<T>) => extendWithSiblingsInternal(eq)([])