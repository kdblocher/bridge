import { either as E, eq, option as O, readonlyArray as RA, readonlyNonEmptyArray as RNEA, string, these as TH, tree as T } from 'fp-ts';
import { flow, identity, pipe } from 'fp-ts/lib/function';
import { castDraft } from 'immer';
import { DecodeError } from 'io-ts/lib/Decoder';
import memoize from 'proxy-memoize';

import { createEntityAdapter, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { Bid, eqBid } from '../model/bridge';
import { chainCollectedErrors, collectErrors, flatten, ForestWithErrors, getAllLeafPaths, getPathForest, getPathUpTo, Path, withImplicitPasses } from '../model/system';
import { ExpandError, expandForest, SyntacticBid } from '../model/system/expander';
import { SystemValidationError, validateTree } from '../model/system/validation';
import { decodeBid } from '../parse';

type BlockKey = string
const eqBlockKey : eq.Eq<BlockKey> = string.Eq

export type DecodedBid = ReturnType<typeof decodeBid>
interface DecodedBidItem {
  id: BlockKey
  value: DecodedBid
}
const decodedBidAdapter = createEntityAdapter<DecodedBidItem>()

type BlockTree = T.Forest<BlockKey>
interface State {
  system: BlockTree
  decodedBids: ReturnType<typeof decodedBidAdapter.getInitialState>
}

const initialState: State = {
  system: [],
  decodedBids: decodedBidAdapter.getInitialState()
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
    },
    cacheSystemConstraints: (state, action: PayloadAction<RNEA.ReadonlyNonEmptyArray<BlockItem>>) => {
      decodedBidAdapter.setMany(state.decodedBids, pipe(
        action.payload,
        RNEA.map(i => ({ id: i.key, value: decodeBid(i.text) }))))
    }
  }
})

export const { setSystem, removeConstraintsByBlockKey, cacheSystemConstraints } = slice.actions

const constrainedBidSelectors = decodedBidAdapter.getSelectors()

interface KeyedState {
  state: State
  key: BlockKey
}

export const selectPathUpToKey = memoize(({ state, key }: KeyedState) =>
  pipe(state.system,
    getPathUpTo(eqBlockKey)(key)))

const getCachedBidByKey = (constrainedBids: State['decodedBids']) => (key: BlockKey) =>
  pipe(
    O.fromNullableK(constrainedBidSelectors.selectById)(constrainedBids, key),
    O.map(i => i.value))

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

export const selectCompleteConstraintForest = memoize(
  flow(selectCompleteSyntaxForest,
    TH.mapLeft(RA.map((error): SystemError => ({ type: "Parse", error }))), 
    chainCollectedErrors(flow(
      expandForest,
      TH.mapLeft(RA.map((error): SystemError => ({ type: "Syntax", error }))))),
    chainCollectedErrors(bidForest => pipe(
      bidForest,
      validateTree,
      TH.bimap(
        (error): ReadonlyArray<SystemError> => RA.of({ type: "Validation", error }),
        () => bidForest)))))

export const selectAllCompleteBidPaths = memoize(
  flow(selectCompleteConstraintForest,
    TH.map(getAllLeafPaths)))

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
    x => { return x },
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