import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { either, hkt, option as O, readonlyArray as RA, readonlyNonEmptyArray as RNEA, separated, tree } from 'fp-ts'
import { flow, pipe } from "fp-ts/lib/function"
import { Functor1 } from "fp-ts/lib/Functor"
import { castDraft } from "immer"
import { decodeBid } from "../parse"


export type DecodedBid = ReturnType<typeof decodeBid>
interface Node {
  blockKey: string
  text: string
  bid: O.Option<DecodedBid>
}

type State = {
  system: tree.Tree<Node>
}
const getRoot = () => tree.make<Node>({ blockKey: "root", text: "root", bid: O.none })
const initialState: State = {
  system: getRoot()
}

const pathsWithoutRoot = <F extends hkt.URIS>(K: Functor1<F>) => <A, B>(f: (a: A, bs: ReadonlyArray<hkt.Kind<F, RNEA.ReadonlyNonEmptyArray<B>>>) => hkt.Kind<F, RNEA.ReadonlyNonEmptyArray<B>>) =>
  flow(tree.fold(f),
    x => K.map(x, RNEA.tail))

type Path = RNEA.ReadonlyNonEmptyArray<Node>
type Paths = RNEA.ReadonlyNonEmptyArray<Path>

const getAllLeafPaths =
  pathsWithoutRoot(RNEA.Functor)((node: Node, paths: ReadonlyArray<Paths>) =>
    pipe(paths,
      RNEA.fromReadonlyArray,
      O.fold(() => [[node]] as Paths,
        RNEA.foldMap(RNEA.getSemigroup<Path>())(RNEA.map(RA.prepend(node))))))

const getPath = (blockKey: string) =>
  pathsWithoutRoot(O.Functor)((node: Node, paths: ReadonlyArray<O.Option<RNEA.ReadonlyNonEmptyArray<Node>>>) => {
    if (node.blockKey === blockKey) {
      return O.some([node])
    } else {
      return pipe(paths,
        RA.findFirstMap(x => x),
        O.map(RA.prepend(node)))
    }
  })


const flatten =
  tree.reduce<Node, readonly Node[]>([], (items, a) =>
    pipe(items, RA.append(a)))

export interface BlockItem {
  key: string
  text: string
  depth: number
}

const buildTree = (items: ReadonlyArray<BlockItem>) => {
  const root = getRoot()
  var parents = [root]
  items.forEach(item => {
    const curr = parents[item.depth + 1] = {
      forest: [],
      value: {
        blockKey: item.key,
        text: item.text,
        bid: O.some(decodeBid(item.text))
      }
    }
    parents[item.depth].forest.push(curr)
  })
  return root
}

const name = 'system'
const slice = createSlice({
  name,
  initialState,
  reducers: {
    setSystem: (state, action: PayloadAction<ReadonlyArray<BlockItem>>) => {
      state.system = pipe(buildTree(action.payload), castDraft)
    }
  }
})

export const { setSystem } = slice.actions

const getBidsFromNodes =
  flow(
    RA.map((n: Node) => n.bid),
    RA.compact)

export const selectNodeByKey = (state: State, blockKey: string) =>
  pipe(
    state.system,
    getPath(blockKey),
    O.chain(RA.last),
    O.toNullable)

export const selectPathByKey = (state: State, blockKey: string) =>
  pipe(
    state.system,
    getPath(blockKey),
    O.toNullable)

export const selectAllCompleteBidPaths = (state: State) =>
  pipe(
    state.system,
    getAllLeafPaths,
    RNEA.map(flow(
      RA.traverse(O.Applicative)((n: Node) => n.bid),
      O.chain(O.fromEitherK(RA.sequence(either.Applicative))),
      O.chain(RNEA.fromReadonlyArray))),
    RA.compact)

export const selectBidsByKey = (state: State, blockKey: string) =>
  pipe(
    getPath(blockKey)(state.system),
    O.getOrElse(() => [] as readonly Node[]),
    getBidsFromNodes,
    RA.sequence(either.Applicative))

export const selectRules = (state: State) =>
  pipe(
    state.system,
    flatten,
    RA.map(n => n.bid),
    RA.compact,
  )

export const selectErrors =
  flow(
    selectRules,
    RA.separate,
    separated.left)

export default slice.reducer