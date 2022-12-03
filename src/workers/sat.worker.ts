import { either as E } from 'fp-ts';

import { Bid } from '../model/bridge';
import { Path } from '../model/system';
import { ConstrainedBid } from '../model/system/core';
import { pathIsSound } from '../model/system/sat';

export const getPathIsSound = (path: Path<ConstrainedBid>): Promise<E.Either<Path<Bid>, void>> =>
  Promise.resolve(pathIsSound(path))