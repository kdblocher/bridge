import * as fc from 'fast-check';
import { eq, predicate, readonlyArray, readonlyNonEmptyArray } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import { iso } from 'monocle-ts';
import { Iso } from 'monocle-ts/Iso';
import { O } from 'ts-toolbelt';

import { Bid, Board, ContractBid, deal, Deal, eqBid, eqBoard, eqContractBid, eqDeal, eqHand, makeBoard, NonContractBid, nonContractBids, ordContractBid, Strain, strains } from './bridge';
import * as serializers from './serialization';
import { deckA, handA } from './test-utils';

/**
* Every serializer is modeled as an Iso<D, S(D)>, and as such, should fulfill the Iso laws:
* 1. `reverseGet(get(s)) = s`
* 2. `get(reversetGet(a)) = a`
*/  
type Serializers = O.Filter<O.P.Pick<typeof serializers, [string, keyof Iso<never, never>]>, {}, 'equals'>
type Getters = O.P.Pick<Serializers, [string, "get"]>
type GetArbitraries<T> = {
  [P in keyof T]: T[P] extends { get: (x: infer U) => unknown } ? U : never
}
type SerializerTypes = O.Omit<GetArbitraries<Getters>, "decodedSerializedHandL" | "isBidPath">
interface Metadata<T> { arb: fc.Arbitrary<T>, eq: eq.Eq<T> }
type SerializerMetadata = { [P in keyof SerializerTypes]: Metadata<SerializerTypes[P]> }

const dealA: fc.Arbitrary<Deal> =
  deckA.map(deal)
const boardA: fc.Arbitrary<Board> =
  fc.tuple(fc.integer({ min: 1 }), dealA)
    .map(([num, deal]) => makeBoard(num)(deal))

const levelA = fc.integer({ min: 1, max: 7 })
const strainA : fc.Arbitrary<Strain> = fc.constantFrom(...strains)
const nonContractBidA: fc.Arbitrary<NonContractBid> = fc.constantFrom(...nonContractBids)
const contractBidA: fc.Arbitrary<ContractBid> =
  fc.tuple(levelA, strainA)
    .map(([level , strain ]) =>
         ({level , strain }))
const bidA: fc.Arbitrary<Bid> = fc.oneof(nonContractBidA, contractBidA)

const asNonEmptyArray = <A>(a: fc.Arbitrary<A[]>): fc.Arbitrary<readonlyNonEmptyArray.ReadonlyNonEmptyArray<A>> =>
  a.map(flow(
    readonlyArray.fromArray,
    x => x as readonlyNonEmptyArray.ReadonlyNonEmptyArray<A>,
  ))

const contractBidPathA: fc.Arbitrary<readonlyNonEmptyArray.ReadonlyNonEmptyArray<ContractBid>> =
  asNonEmptyArray(fc.set(contractBidA, { minLength: 1 })).map(
    readonlyNonEmptyArray.sort(ordContractBid))

const passBidPathA = fc.constant<"Pass">("Pass").map(readonlyNonEmptyArray.of)
const bidPathA: fc.Arbitrary<readonlyNonEmptyArray.ReadonlyNonEmptyArray<Bid>> =
  fc.oneof(contractBidPathA, passBidPathA, contractBidPathA.map(readonlyArray.append<Bid>("Pass")))

const metadata: SerializerMetadata = {
  serializedHandL:    { arb: handA,    eq: eqHand },
  serializedDealL:    { arb: dealA,    eq: eqDeal },
  serializedBoardL:   { arb: boardA,   eq: eqBoard },
  serializedBidL:     { arb: bidA,     eq: eqBid },
  serializedContractBidL: { arb: contractBidA, eq: eqContractBid },
  serializedBidPathL: { arb: bidPathA, eq: readonlyNonEmptyArray.getEq(eqBid) }
}

const getPredicate = <T, U>(serializer: iso.Iso<T, U>, eq: eq.Eq<T>): predicate.Predicate<T> =>
  (v) => pipe(v, serializer.get, serializer.reverseGet, v2 => eq.equals(v, v2))

const getAssert = <T, U>(serializer: iso.Iso<T, U>, metadata: Metadata<T>) =>
  () => fc.assert(fc.property(metadata.arb, getPredicate(serializer, metadata.eq)))

const getStuff = <P extends keyof typeof metadata>(p: P) => <T, U>(): readonly [iso.Iso<T, U>, Metadata<T>] =>
  [serializers[p], metadata[p]] as any // I give up

for (const x in metadata) {
  const k = x as keyof typeof metadata
  const [a, b] = getStuff(k)()
  test(x, getAssert(a, b))
}