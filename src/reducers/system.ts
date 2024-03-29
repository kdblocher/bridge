import { either as E, eq, option as O, readonlyArray as RA, readonlyNonEmptyArray as RNEA, readonlyTuple, state, string, these as TH, tree as T } from 'fp-ts';
import { observable as Ob } from 'fp-ts-rxjs';
import { apply, constFalse, flow, identity, pipe } from 'fp-ts/lib/function';
import { castDraft } from 'immer';
import * as t from 'io-ts';
import { DecodeError } from 'io-ts/lib/Decoder';
import memoize from 'proxy-memoize';
import { Epic } from 'redux-observable';
import { debounceTime } from 'rxjs';

import { datum as D } from '@nll/datum';
import { AnyAction, createEntityAdapter, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { RootState } from '../app/store';
import { values } from '../lib/array';
import { get } from '../lib/object';
import { Bid, eqBid } from '../model/bridge';
import { chainCollectedErrors, collectErrors, flatten, ForestWithErrors, getAllLeafPaths, getPathForest, getPathUpTo, Path, withImplicitPasses } from '../model/system';
import { ExpandError, expandForest, SyntacticBid } from '../model/system/expander';
import { SystemValidationError, validateForest } from '../model/system/validation';
import { decodeBid } from '../parse';
import { observeValidation } from '../workers';

type BlockKey = string
const eqBlockKey : eq.Eq<BlockKey> = string.Eq

export type DecodedBid = ReturnType<typeof decodeBid>
interface DecodedBidItem {
  id: BlockKey
  value: DecodedBid
}
const decodedBidAdapter = createEntityAdapter<DecodedBidItem>()

type SerializedBlockKeyPath = t.Branded<string, { readonly BlockKeyPath: unique symbol }>
interface ValidatedPathItem {
  id: SerializedBlockKeyPath
  value: D.Datum<boolean>
}
const validatedPathAdapter = createEntityAdapter<ValidatedPathItem>()

type BlockTree = T.Forest<BlockKey>
interface State {
  system: BlockTree
  decodedBids: ReturnType<typeof decodedBidAdapter.getInitialState>
  validatedPaths: ReturnType<typeof validatedPathAdapter.getInitialState>
}

const initialState: State = {
  system: [],
  decodedBids: decodedBidAdapter.getInitialState(),
  validatedPaths: validatedPathAdapter.getInitialState()
}

export interface BlockKeyDescriptor {
  key: BlockKey
  depth: number
}
const buildForest = (items: ReadonlyArray<BlockKeyDescriptor>): BlockTree => {
  const root = T.make<BlockKey>("ROOT")
  var parents = [root]
  items.forEach(item => {
    const curr = parents[item.depth + 1] = {
      forest: [],
      value: item.key
    }
    parents[item.depth].forest.push(curr)
  })
  return root.forest
}

export interface BlockItem {
  key: string
  text: string
}

const name = 'system'
const slice = createSlice({
  name,
  initialState,
  reducers: {
    setSystem: (state, action: PayloadAction<ReadonlyArray<BlockKeyDescriptor>>) => {
      state.system = pipe(buildForest(action.payload), castDraft)
    },
    removeConstraintsByBlockKey: (state, action: PayloadAction<RNEA.ReadonlyNonEmptyArray<BlockKey>>) => {
      decodedBidAdapter.removeMany(state.decodedBids, action.payload)
      // validatedPathAdapter.removeMany(
      validatedPathAdapter.removeMany(state.validatedPaths,
        pipe(state.validatedPaths.ids as unknown as ReadonlyArray<SerializedBlockKeyPath>,
          RA.filter(path => pipe(action.payload, RA.exists(flow(string.includes, apply(path)))))))
    },
    cacheSystemConstraints: (state, action: PayloadAction<RNEA.ReadonlyNonEmptyArray<BlockItem>>) => {
      const decodedBids = pipe(action.payload, RNEA.map((i): DecodedBidItem => ({ id: i.key, value: decodeBid(i.text) })))
      decodedBidAdapter.setMany(state.decodedBids, decodedBids)
    },
    validateSystem: (state) => { },
    reportValidationResult: (state, action: PayloadAction<readonly [Path<Bid>, boolean]>) => {
      pipe(action.payload,
        readonlyTuple.fst,
        path => getValidationPathKeyByPath({ state, path }),
        O.map(flow(
          (id): ValidatedPathItem => ({ id, value: pipe(action.payload, readonlyTuple.snd, D.replete) }),
          i => validatedPathAdapter.upsertOne(state.validatedPaths, i))))
    }
  }
})

export const { setSystem, removeConstraintsByBlockKey, cacheSystemConstraints, validateSystem, reportValidationResult } = slice.actions

const constrainedBidSelectors = decodedBidAdapter.getSelectors()

interface KeyedState {
  state: State
  key: BlockKey
}

const getCachedBidByKey = (constrainedBids: State['decodedBids']) => (key: BlockKey) =>
  pipe(
    O.fromNullableK(constrainedBidSelectors.selectById)(constrainedBids, key),
    O.map(i => i.value))

interface StateWithPath {
  state: State
  path: Path<Bid>
}
const getValidationPathKeyByPath = (({ state, path }: StateWithPath) => 
  pipe(path,
    RNEA.traverse(O.Applicative)(b1 => pipe(
      state.decodedBids.entities,
      values,
      RA.filterMap(O.fromNullable),
      RA.findFirst(x => pipe(x.value, O.fromEither, O.map(get('bid')), b2 => O.elem(eqBid)(b1, b2))),
      O.map(get('id')))),
    O.map(flow(
      RNEA.intersperse('.'),
      RNEA.foldMap(string.Semigroup)(identity),
      x => x as SerializedBlockKeyPath))))

export const selectBidByKey = memoize(({ state, key }: KeyedState) =>
  pipe(key,
    getCachedBidByKey(state.decodedBids),
    O.chain(O.fromEither)))

export const selectBidPathUpToKey = memoize(({ state, key }: KeyedState) =>
  pipe(
    state.system,
    getPathUpTo(eqBlockKey)(key),
    O.getOrElse(() => RA.zero()),
    RA.filterMap(getCachedBidByKey(state.decodedBids)),
    RA.sequence(E.Applicative)))

export const selectRules = memoize((state: State) =>
  pipe(state.system,
    flatten,
    RA.filterMap(getCachedBidByKey(state.decodedBids))))

export const selectErrors = memoize(
  flow(
    selectRules,
    RA.lefts))

const getCompleteForest = (bids: State['decodedBids']) =>
  flow(
    RA.filterMap(T.traverse(O.Applicative)(getCachedBidByKey(bids))),
    collectErrors)

interface OptionsState {
  state: State
  options?: { implicitPass: boolean }
}
export const selectCompleteSyntaxForest = memoize(({ state, options }: OptionsState): ForestWithErrors<DecodeError, SyntacticBid> =>
  pipe(state.system,
    getCompleteForest(state.decodedBids),
    TH.map(options?.implicitPass ? withImplicitPasses : identity)))

interface SystemErrorParse { type: "Parse", error: DecodeError }
interface SystemErrorSyntax { type: "Syntax", error: ExpandError }
interface SystemErrorValidation { type: "Validation", error: SystemValidationError }
export type SystemErrorWithPath = SystemErrorSyntax | SystemErrorValidation
export type SystemError =
  | SystemErrorParse
  | SystemErrorSyntax
  | SystemErrorValidation

export const selectExpandedConstraintForest = memoize(
  flow(selectCompleteSyntaxForest,
    TH.mapLeft(RA.map((error): SystemError => ({ type: "Parse", error }))), 
    chainCollectedErrors(flow(
      expandForest,
      TH.mapLeft(RA.map((error): SystemError => ({ type: "Syntax", error })))))))

export const selectCompleteConstraintForest = memoize(
  flow(selectExpandedConstraintForest,
    chainCollectedErrors(bidForest => pipe(
      bidForest,
      validateForest,
      TH.bimap(
        (error): ReadonlyArray<SystemError> => RA.of({ type: "Validation", error }),
        () => bidForest)))))

export const selectSystemWithErrors = memoize(
  flow(selectCompleteConstraintForest,
    TH.map(getAllLeafPaths)))

export const selectPristineSystem = memoize(
  flow(selectSystemWithErrors,
    TH.getRightOnly,
    O.chain(RNEA.fromReadonlyArray)))

export const selectValidConstrainedBidPaths = memoize(
  flow(selectSystemWithErrors,
    TH.getRight,
    O.chain(RNEA.fromReadonlyArray)))

export const selectCompleteBidPathUpToKey = memoize((state: KeyedState & OptionsState) =>
  pipe(O.Do,
    O.apS('path', O.fromEitherK(selectBidPathUpToKey)(state)),
    O.apS('paths', pipe(state, selectCompleteConstraintForest, TH.getRight, O.map(getAllLeafPaths))),
    O.chain(({ path, paths }) =>
      pipe(paths,
        RA.findFirst(cbPath =>
          RA.getEq(pipe(eqBid, eq.contramap((b: { bid: Bid }) => b.bid)))
            .equals(path, cbPath))))))

export const selectCompleteBidByKey = flow(
  selectCompleteBidPathUpToKey,
  O.map(RNEA.last))

const eqBidPath = pipe(eqBid, RA.getEq)
export interface ErrorNode {
  bid: Bid
  path: Path<Bid>
  errors: ReadonlyArray<SystemErrorWithPath>
}
export const selectErrorTree = memoize((options: OptionsState) =>
  pipe(options,
    selectCompleteSyntaxForest,
    TH.map(flow(
      RA.map(T.map(sb => sb.bid)),
      getPathForest,
      RA.toArray,
      pathForest => pipe(options,
        selectCompleteConstraintForest,
        TH.getLeft,
        O.getOrElse(() => RA.zero()),
        RA.filterMap(e => e.type !== "Parse" ? O.some(e) : O.none),
        errors =>
          pipe(pathForest,
            RA.map(T.map((path): ErrorNode => ({
              bid: pipe(path, RNEA.last),
              path,
              errors: pipe(errors, RA.filter(e => eqBidPath.equals(e.error.path, path)))
            })))))))))

export const selectErrorsByKey = memoize((state: KeyedState & OptionsState) =>
  pipe(O.Do,
    O.apS('errors', pipe(state,
      selectErrorTree,
      TH.getRight)),
    O.apS('sb', selectBidByKey(state)),
    O.fold(() => RA.empty,
      ({ sb, errors }) => pipe(errors,
        flatten,
        RA.filter(e => eqBid.equals(sb.bid, e.bid))))))
    
export default slice.reducer

export const epics : ReadonlyArray<Epic<AnyAction, AnyAction, RootState>> = [
  flow(Ob.filter(setSystem.match),
    debounceTime(1000),
    Ob.map(() => validateSystem())),
  (action$, state$) => pipe(action$,
    Ob.filter(validateSystem.match),
    // takeUntil(pipe(action$, Ob.filter(setSystem.match))),
    Ob.chain(() => pipe(
      { state: state$.value.system },
      selectExpandedConstraintForest,
      TH.getRight,
      O.fold(() => RA.empty, getAllLeafPaths),
      RA.filter(flow(
        RNEA.map(get('bid')),
        path => getValidationPathKeyByPath({ state: state$.value.system, path }),
        O.fold(constFalse, bp => !state$.value.system.validatedPaths.ids.includes(bp)))),
      observeValidation)),
    Ob.map(reportValidationResult))
]