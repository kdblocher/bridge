import { these } from 'fp-ts';
import JSONPretty from 'react-json-pretty';
import styled from 'styled-components';

import { useAppSelector } from '../app/hooks';
import { selectCompleteConstraintForest, selectCompleteSyntaxForest } from '../reducers/system';

const TreeDiv = styled.div `
  display: grid;
  grid-template-columns: 1fr 1fr;
`

const SystemDetails = () => {
  const obj = useAppSelector(state => ({ state: state.system, options: state.settings }))
  const syntax = selectCompleteSyntaxForest(obj)
  const bidForest = selectCompleteConstraintForest(obj)

  return (
    <section>
      <h3>System</h3>
      <TreeDiv>
        <div>
          <h4>Syntax Tree</h4>
          <JSONPretty data={syntax} />
        </div>
        <div>
          <h4>Constraint Tree</h4>
          {these.isRight(bidForest) && <JSONPretty data={bidForest} />}
        </div>
      </TreeDiv>
    </section>
  )
}

export default SystemDetails