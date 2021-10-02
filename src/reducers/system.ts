import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { either, option, readonlyArray, separated, tree } from 'fp-ts'
import { flow, identity, pipe } from "fp-ts/lib/function"
import { castDraft } from "immer"
import { decodeBid } from "../parse"


interface Node {
  blockKey?: string
  text: string
  bid?: ReturnType<typeof decodeBid>
}

type State = {
  system: tree.Tree<Node>
}
const getRoot = () => tree.make<Node>({ text: "root" })
const initialState: State = {
  system: getRoot()
}

const getPath = (blockKey: string) =>
  flow(
    tree.fold<Node, option.Option<ReadonlyArray<Node>>>((node, path) => {
      if (node.blockKey === blockKey) {
        return option.some([node])
      } else {
        return pipe(path,
          readonlyArray.findFirstMap(identity),
          option.map(readonlyArray.prepend(node)))
      }
    }),
    option.chain(readonlyArray.tail))


const flatten =
  tree.reduce<Node, readonly Node[]>([], (items, a) =>
    pipe(items, readonlyArray.append(a)))

export interface BlockItem {
  key: string
  text: string
  depth: number
}

const buildTree = (items: BlockItem[]) => {
  const root = getRoot()
  var parents = [root]
  items.forEach(item => {
    const curr = parents[item.depth + 1] = { value: { blockKey: item.key, text: item.text, bid: decodeBid(item.text) }, forest: [] }
    parents[item.depth].forest.push(curr)
  })
  return root
}

const name = 'system'
const slice = createSlice({
  name,
  initialState,
  reducers: {
    setSystem: (state, action: PayloadAction<BlockItem[]>) => {
      state.system = pipe(buildTree(action.payload), castDraft)
    }
  }
})

export const { setSystem } = slice.actions

export const selectNode = (state: State, blockKey: string) =>
  pipe(getPath(blockKey)(state.system),
    option.chain(readonlyArray.last),
    option.toNullable)

export const selectPath = (state: State, blockKey: string) =>
  pipe(
    getPath(blockKey)(state.system),
    option.toNullable)

export const selectBids = (state: State, blockKey: string) =>
  pipe(
    getPath(blockKey)(state.system),
    option.getOrElse(() => [] as readonly Node[]),
    readonlyArray.map(n => option.fromNullable(n.bid)),
    readonlyArray.compact,
    readonlyArray.sequence(either.Applicative))

export const selectRules = (state: State) =>
  pipe(
    state.system,
    flatten,
    readonlyArray.map(n => option.fromNullable(n.bid)),
    readonlyArray.compact,
  )

export const selectErrors =
  flow(
    selectRules,
    readonlyArray.separate,
    separated.left)

export default slice.reducer