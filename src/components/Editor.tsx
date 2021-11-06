import 'draft-js/dist/Draft.css';

import { ContentBlock, convertFromRaw, convertToRaw, Editor as DraftJsEditor, EditorState, getDefaultKeyBinding, RichUtils } from 'draft-js';
import { eq, monoid, option, ord, readonlyArray, readonlyNonEmptyArray, readonlySet, string } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { selectBlockKey, setSelectedBlockKey } from '../reducers/selection';
import { BlockItem, BlockKeyDescriptor, cacheSystemConstraints, removeConstraintsByBlockKey, setSystem } from '../reducers/system';

const EditorDiv = styled.div `
  font-family: Cascadia Code, Consolas, monospace;
  font-size: 0.8em;
`

const getDescriptorFromContentBlock = (x: ContentBlock): BlockKeyDescriptor & BlockItem => ({
  key: x.getKey(),
  text: x.getText(),
  depth: x.getDepth()
})

const eqContentBlock = monoid.concatAll(eq.getMonoid<ContentBlock>())([
  eq.contramap((b: ContentBlock) => b.getKey())(string.Eq),
  eq.contramap((b: ContentBlock) => b.getText())(string.Eq)
])
const getBlocks = (editorState: EditorState) => pipe(
  editorState.getCurrentContent().getBlocksAsArray(),
  readonlySet.fromReadonlyArray(eqContentBlock))

const Editor = () => {
  const [editorState, setEditorState] = useState(() => EditorState.createEmpty())
  const [blocks, setBlocks] = useState(() => getBlocks(editorState))
  const dispatch = useAppDispatch()
  const selectedBlockKey = useAppSelector(state => selectBlockKey(state.selection))

  const onChange = useCallback((editorState: EditorState) => {
    setEditorState(editorState)
    setTimeout(() => localStorage.setItem("editor", JSON.stringify(convertToRaw(editorState.getCurrentContent()))), 0)
    const newBlocks = getBlocks(editorState)
    const same = readonlySet.intersection(eqContentBlock)(blocks, newBlocks)
    const removed = readonlySet.difference(eqContentBlock)(blocks, same)
    const added = readonlySet.difference(eqContentBlock)(newBlocks, same)
    setBlocks(newBlocks)

    if (!readonlySet.isEmpty(monoid.concatAll(readonlySet.getUnionMonoid<ContentBlock>(eqContentBlock))([removed, added]))) {
      dispatch(pipe(
        newBlocks,
        readonlySet.toReadonlyArray<ContentBlock>(ord.trivial),
        readonlyArray.map(getDescriptorFromContentBlock),
        setSystem))
      pipe(
        removed,
        readonlySet.toReadonlyArray<ContentBlock>(ord.trivial),
        readonlyNonEmptyArray.fromReadonlyArray,
        option.map(flow(
          readonlyNonEmptyArray.map(b => b.getKey()),
          x => dispatch(removeConstraintsByBlockKey(x)))))
      pipe(
        added,
        readonlySet.toReadonlyArray<ContentBlock>(ord.trivial),
        readonlyNonEmptyArray.fromReadonlyArray,
        option.map(flow(
          readonlyNonEmptyArray.map(getDescriptorFromContentBlock),
          x => dispatch(cacheSystemConstraints(x)))))
    }
    
    const newSelectedBlockKey = editorState.getSelection().getFocusKey()
    if (newSelectedBlockKey !== selectedBlockKey) {
      dispatch(setSelectedBlockKey(option.some(newSelectedBlockKey)))
    }
  }, [blocks, dispatch, selectedBlockKey])

  useEffect(() => {
    const savedEditorState = localStorage.getItem("editor")
    if (savedEditorState) {
      setEditorState(() => EditorState.createWithContent(convertFromRaw(JSON.parse(savedEditorState))))
    } else {
      setEditorState(() => RichUtils.toggleBlockType(editorState, 'unordered-list-item'))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  return (
    <EditorDiv>
      <DraftJsEditor
        editorState={editorState}
        onChange={onChange}
        // https://github.com/facebook/draft-js/blob/master/examples/draft-0-10-0/rich/rich.html#L61
        keyBindingFn={e => {
          if (e.keyCode === 9 /* TAB */) {
            const newEditorState = RichUtils.onTab(e, editorState, 10, /* maxDepth */);
            if (newEditorState !== editorState) {
              onChange(newEditorState)
            }
            return null;
          }
          return getDefaultKeyBinding(e);
        }}
      />
    </EditorDiv>
  )
}

export default Editor