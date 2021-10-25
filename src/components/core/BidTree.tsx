import { option, readonlyArray, tree as T } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';

import { BidPath, BidTree, pathTree } from '../../model/system';
import BidPathView from './BidPath';

interface Props {
  tree: BidTree
  children?: (path: BidPath) => JSX.Element
}
const BidTreeView = ({ tree, children }: Props) => 
  <ul>
    {pipe(tree, pathTree,
      T.foldMap(readonlyArray.getMonoid<BidPath>())(readonlyArray.of),
      readonlyArray.tail,
      option.fold(() => [<></>],
        readonlyArray.mapWithIndex((i, path) => 
          <li key={i}>
            <BidPathView path={path} />
            {children && children(path)}
          </li>)))}
  </ul>

export default BidTreeView