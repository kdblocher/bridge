export function* alternate<A>(opener: A, responder: A) {
  while (true) { yield opener; yield responder }
}

export const unfold = (length: number) => <A>(g: Generator<A>) : readonly A[] => {
  const val = g.next()
  return val.done || length === 0 ? [] : [val.value, ...unfold(length - 1)(g)]
}