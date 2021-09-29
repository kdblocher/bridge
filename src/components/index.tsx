import 'draft-js/dist/Draft.css';

import { BlockItem, selectPath, setSystem } from '../reducers/system';
import {Editor, EditorState, RichUtils, SelectionState, getDefaultKeyBinding} from 'draft-js';
import React, { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks';

import styled from 'styled-components'
import { useCallback } from 'react';

// import { useAppDispatch } from '../app/hooks';

const getItemsFromBlocks = (editorState: EditorState) =>
  editorState.getCurrentContent().getBlockMap().toArray().map<BlockItem>(x => ({
    key: x.getKey(),
    text: x.getText(),
    depth: x.getDepth()
  }))

const App = () => {
  const [editorState, setEditorState] = React.useState(() => EditorState.createEmpty());
  const dispatch = useAppDispatch()
  const [selected, setSelected] = React.useState<string | null>(() => null)

  const onChange = useCallback((editorState: EditorState) => {
    setEditorState(editorState)
    dispatch(setSystem(getItemsFromBlocks(editorState)))
    setSelected(editorState.getSelection().getFocusKey())
  }, [dispatch])

  const path = useAppSelector(state => {
    return selected ? selectPath(state.system, selected) : null
  })
  
  useEffect(() => {
    setEditorState(() => RichUtils.toggleBlockType(editorState, 'unordered-list-item'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  return (
    <div className="App"> 
      <Editor
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
      ---
      <div>
        Path: {path?.map(x => x.text).join(" > ")}
      </div>
      {/* <JSONTree data={editorState} /> */}
    </div>
  )
}

export default App
