import { either } from 'fp-ts';
import JSONPretty from 'react-json-pretty';
import styled from 'styled-components';

import { useAppSelector } from '../app/hooks';
import { selectCompleteConstraintForest, selectCompleteSyntaxForest, selectSystemValid } from '../reducers/system';

const TreeDiv = styled.div `
  display: grid;
  grid-template-columns: 1fr 1fr;
`

const SystemDetails = () => {
  const obj = useAppSelector(state => ({ state: state.system, options: state.settings }))
  const syntax = selectCompleteSyntaxForest(obj)
  const bidForest = selectCompleteConstraintForest(obj)
  const valid = selectSystemValid(obj)

  return (
    <section>
      <h3>System</h3>
      {either.isLeft(valid) && 
        <div style={{float: "right"}}>
          <h4>Errors</h4>
          <JSONPretty data={valid} />
        </div>}
      <TreeDiv>
        <div>
          <h4>Syntax Tree</h4>
          <JSONPretty data={syntax} />
        </div>
        <div>
          <h4>Constraint Tree</h4>
          {either.isRight(bidForest) && <JSONPretty data={bidForest} />}
        </div>
      </TreeDiv>
    </section>
  )
}

export default SystemDetails