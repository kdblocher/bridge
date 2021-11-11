import { readonlyArray } from 'fp-ts';
import { apply, pipe } from 'fp-ts/lib/function';
import { from, Observable, ObservableInput, Subject, zip } from 'rxjs';
import { finalize, mergeMap, tap } from 'rxjs/operators';

// adapted from https://github.com/cloudnc/observable-webworker/blob/master/projects/observable-webworker/src/lib/from-worker-pool.ts

interface LazyWorker<W extends Worker> {
  factory: () => W
  terminate: () => void
  processing: boolean
  index: number
}

const pool = <W extends Worker, I, O>(ctor: (index: number) => W, doWork: (worker: W) => (input: I) => Promise<O>) => (input$: ObservableInput<I>) => {
  const maxParallel = navigator.hardwareConcurrency ? navigator.hardwareConcurrency - 1 : 1

  return new Observable<O>(resultObserver => {
    const idleWorker$$ = new Subject<LazyWorker<W>>()

    let completed = 0
    let sent = 0
    let finished = false

    const workers = readonlyArray.makeBy(maxParallel, (index): LazyWorker<W> => {
      let cachedWorker: W | null = null
      return {
        factory: () => cachedWorker ?? (cachedWorker = ctor(index)),
        terminate() {
          if (!this.processing && cachedWorker) {
            // try {
            //   cachedWorker.terminate()
            // } catch { }
          }
        },
        processing: false,
        index,
      }
    })

    const processor$ = zip(idleWorker$$, input$).pipe(
      tap(([worker]) => {
        sent++
        worker.processing = true
      }),
      finalize(() => {
        idleWorker$$.complete()
        finished = true
        workers.forEach(worker => worker.terminate())
      }),
      mergeMap(([worker, item]) =>
        pipe(worker.factory(),
          doWork,
          apply(item),
          from,
          finalize(() => {
            completed++
            worker.processing = false
            if (!finished) {
              idleWorker$$.next(worker)
            } else {
              worker.terminate()
            }
            // console.log("finished: " + finished + ", sent: " + sent + ", completed: " + completed)
            if (finished && completed === sent) {
              resultObserver.complete()
            }
          }),
        )))

    const sub = processor$.subscribe(resultObserver)
    workers.forEach(w => idleWorker$$.next(w))
    return () => sub.unsubscribe()
  })
}

export default pool