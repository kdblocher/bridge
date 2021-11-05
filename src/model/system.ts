import { either as E, eq, option as O, readonlyArray as RA, readonlyNonEmptyArray as RNEA, readonlyRecord, readonlyTuple, show, these, tree as T } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';

import { SyntacticBid } from './system/expander';

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
          RA.map(T.map(path => RNEA.concat(path)(a))), RA.toArray))),
      T.map(x => RNEA.tail(x) as RNEA.ReadonlyNonEmptyArray<A>))))

export const getAllLeafPaths = <A>(forest: Forest<A>): ReadonlyArray<Path<A>> =>
  pipe(forest,
    RA.chain(
      T.fold((node: A, paths: ReadonlyArray<Paths<A>>): Paths<A> =>
        pipe(paths,
          RNEA.fromReadonlyArray,
          O.fold(() => [[node]],
            RNEA.foldMap(RNEA.getSemigroup<Path<A>>())(RNEA.map(RA.prepend(node))))))),
    RA.filterMap(RNEA.fromReadonlyArray))

export const getForestFromLeafPaths = <A, F extends show.Show<A>>(show: F) => (paths: ReadonlyArray<Path<A>>): Forest<A> =>
  pipe(paths,
    RNEA.fromReadonlyArray,
    O.fold(
      () => RA.empty,
      flow(
        RNEA.groupBy(flow(RNEA.head, show.show)),
        readonlyRecord.toReadonlyArray,
        RA.map(flow(
          readonlyTuple.snd,
          paths => T.make(
            RNEA.head(RNEA.head(paths)),
            pipe(paths,
              RNEA.map(flow(
                RNEA.tail,
                RNEA.fromReadonlyArray)),
              RA.compact,
              getForestFromLeafPaths(show),
              RA.toArray)))))))

const extendTreeWithSiblings = <A>(eqA: eq.Eq<A>) => (siblings: ReadonlyArray<A>) => (t: T.Tree<A>) : T.Tree<A & { siblings: ReadonlyArray<A> }> =>
  T.make(
    ({ ...t.value, siblings }),
    pipe(t.forest, RA.map(u =>
      pipe(t.forest,
        RA.map(t => t.value),
        RA.difference(eqA)([u.value]), // end null hack
        extendTreeWithSiblings(eqA))(u)),
      RA.toArray))

export const extendForestWithSiblings = <A>(eqA: eq.Eq<A>) => (forest: Forest<A>) =>
  pipe(forest, RA.map(t =>
    pipe(forest,
      RA.map(t => t.value),
      RA.difference(eqA)([t.value]),
      extendTreeWithSiblings(eqA))(t)))

export const withImplicitPasses =
  RA.map(
    T.fold((a: SyntacticBid, bs: T.Forest<SyntacticBid>) =>
      bs.length === 0 || pipe(bs, RA.exists(t => t.value.bid === "Pass"))
      ? T.make(a, bs)
      : T.make(a, pipe(bs,
        RA.append(T.make<SyntacticBid>({ bid: "Pass", syntax: { type: "Otherwise" }})),
        RA.toArray))))

type ForestWithErrors<L, R> = these.These<ReadonlyArray<L>, Forest<R>>
export const collectErrors = <L, R>(forest: Forest<E.Either<L, R>>): ForestWithErrors<L, R> =>
  pipe(forest,
    RA.map(T.traverse(these.getApplicative(RA.getMonoid<L>()))(E.mapLeft(RA.of))),
    RA.sequence(these.getApplicative(RA.getSemigroup<L>())))
      