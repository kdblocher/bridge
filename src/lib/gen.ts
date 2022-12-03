export function* alternate<A>(opener: A, responder: A) {
  while (true) { yield opener; yield responder }
}

export const unfold = (length: number) => <A>(g: Generator<A>) : readonly A[] => {
  const val = g.next()
  return val.done || length === 0 ? [] : [val.value, ...unfold(length - 1)(g)]
}

export function* take<T>(generator: Generator<T>, n: number) {
  for (var i = 0; i < n; i++) {
    let v = generator.next()
    if (!v.done) {
      yield v.value
    } else {
      break
    }
  }
}