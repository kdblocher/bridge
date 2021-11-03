import { either as E, eq, option as O, readonlyArray as RA, readonlyNonEmptyArray as RNEA, string, tree } from 'fp-ts';
import { flow, identity, pipe } from 'fp-ts/lib/function';
import { castDraft } from 'immer';
import memoize from 'proxy-memoize';

import { createEntityAdapter, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { flatten, Forest, getAllLeafPaths, getPathUpTo, withImplicitPasses } from '../model/system';
import { expandForest, SyntacticBid } from '../model/system/expander';
import { validateTree } from '../model/system/validation';
import { decodeBid } from '../parse';

type BlockKey = string
const eqBlockKey : eq.Eq<BlockKey> = string.Eq

export type DecodedBid = ReturnType<typeof decodeBid>
interface DecodedBidItem {
  id: BlockKey
  value: DecodedBid
}
const decodedBidAdapter = createEntityAdapter<DecodedBidItem>()

type BlockTree = tree.Forest<BlockKey>
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
  const root = tree.make<BlockKey>("ROOT")
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

const getCompleteForest = (bids: State['decodedBids']) : (t: Forest<BlockKey>) => Forest<SyntacticBid> =>
  RA.filterMap(flow(
    tree.traverse(O.Applicative)(flow(
      getCachedBidByKey(bids),
      O.chain(O.fromEither)))))

export const selectCompleteBidPathUpToKey = memoize(({ state, key }: KeyedState) =>
  pipe(state.system,
    getPathUpTo(eqBlockKey)(key),
    O.chain(keys => pipe(
      tree.unfoldTree<BlockKey, ReadonlyArray<BlockKey>>(keys, ([n0, ...ns]) =>
        [n0, ns.length === 0 ? [] : [ns]]),
      RA.of,
      getCompleteForest(state.decodedBids),
      O.fromEitherK(expandForest))),
    O.chain(flow(
      getAllLeafPaths,
      RA.head))))

export const selectCompleteSyntaxForest = memoize(({ state, options }: { state: State, options?: { implicitPass: boolean }} ) =>
  pipe(state.system,
    getCompleteForest(state.decodedBids),
    options?.implicitPass ? withImplicitPasses : identity))

export const selectCompleteConstraintForest = memoize(
  flow(selectCompleteSyntaxForest,
    expandForest))

export const selectAllCompleteBidPaths = memoize(
  flow(selectCompleteConstraintForest,
    E.map(getAllLeafPaths)))

export const selectSystemValid = memoize(
  flow(selectCompleteConstraintForest,
    E.chainW(validateTree)))
    
export default slice.reducer