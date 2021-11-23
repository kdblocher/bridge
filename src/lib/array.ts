import { readonlyArray, readonlyRecord, readonlyTuple } from 'fp-ts';
import { flow } from 'fp-ts/lib/function';

export function* permute<T>(values: ReadonlyArray<T>) {
  const permutation = Array.from(values)
  var length = permutation.length,
      c = Array(length).fill(0),
      i = 1, k, p;

  yield permutation.slice();
  while (i < length) {
    if (c[i] < i) {
      k = i % 2 && c[i];
      p = permutation[i];
      permutation[i] = permutation[k];
      permutation[k] = p;
      ++c[i];
      i = 1;
      yield permutation.slice();
    } else {
      c[i] = 0;
      ++i;
    }
  }
}

export const values = flow(readonlyRecord.toReadonlyArray, readonlyArray.map(readonlyTuple.snd))
