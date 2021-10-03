import 'draft-js/dist/Draft.css';

import { BlockItem, setSystem } from '../reducers/system';
import { Editor as DraftJsEditor, EditorState, RichUtils, convertFromRaw, convertToRaw, getDefaultKeyBinding } from 'draft-js';
import { useCallback, useEffect, useState } from 'react';

import { option } from 'fp-ts';
import { setSelectedBlockKey } from '../reducers/selection';
import { useAppDispatch } from '../app/hooks';

const getItemsFromBlocks = (editorState: EditorState) =>
  editorState.getCurrentContent().getBlockMap().toArray().map<BlockItem>(x => ({
    key: x.getKey(),
    text: x.getText(),
    depth: x.getDepth()
  }))

const Editor = () => {
  const [editorState, setEditorState] = useState(() => EditorState.createEmpty());
  const dispatch = useAppDispatch()

  const onChange = useCallback((editorState: EditorState) => {
    setEditorState(editorState)
    localStorage.setItem("editor", JSON.stringify(convertToRaw(editorState.getCurrentContent())))
    dispatch(setSystem(getItemsFromBlocks(editorState)))
    dispatch(setSelectedBlockKey(option.some(editorState.getSelection().getFocusKey())))
  }, [dispatch])

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
  )
}

export default Editor