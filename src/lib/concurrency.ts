import { Observable, from } from 'rxjs';

import { pipe } from 'fp-ts/lib/function';
import { readonlyArray } from 'fp-ts';

const maxProcessors = Math.max(window.navigator.hardwareConcurrency - 2, 1)

export const parallelize = <T>(make: (concurrency: number) => (idx: number) => Observable<T>) : Observable<Observable<T>> =>
  pipe(
    maxProcessors,
    make,
    f => readonlyArray.makeBy(maxProcessors, f),
    t => from(t))