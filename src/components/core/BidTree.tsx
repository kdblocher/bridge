import { option, readonlyArray as RA, tree as T } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import { Fragment } from 'react';
import styled from 'styled-components';

import { BidPath, BidTree, pathTree } from '../../model/system';
import BidPathView from './BidPath';

const GridContainer = styled.div `
  clear: both;
  display: inline-grid;
  grid-template-columns: auto auto;
  width: auto;
`
interface Props {
  tree: BidTree
  children?: (path: BidPath) => JSX.Element
}
const BidTreeView = ({ tree, children }: Props) => 
  <GridContainer>
    {pipe(tree, pathTree,
      RA.chain(
        T.foldMap(RA.getMonoid<BidPath>())(RA.of)),
      RA.mapWithIndex((i, path) =>
        <Fragment key={i}>
          <BidPathView path={path} />
          {children && children(path)}
        </Fragment>))}
  </GridContainer>

export default BidTreeView