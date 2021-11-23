// Due to the way comlink-loader works, types cannot be imported at the top level, and must be imported via (import "...") statements.
declare module 'comlink-loader!./deal.worker' {
  type SerializedDeal = import ("../model/serialization").SerializedDeal
  type Either<E, A> = import ('fp-ts').either.Either<E, A>
  type GenerationId = import ('../model/job').GenerationId
  class DealWorker extends Worker {
    constructor();
    genDeals(count: number, generationId: GenerationId): Promise<Either<string, ReadonlyArray<SerializedDeal>>>;
  }
  export = DealWorker;
}

declare module 'comlink-loader!./satisfies.worker' {
  type ConstrainedBid = import ("../model/system/core").ConstrainedBid
  type SerializedHand = import ("../model/serialization").SerializedHand
  type Path<A> = import ("../model/system").Path<A>
  type Direction = import ("../model/bridge").Direction
  type Either<E, A> = import ('fp-ts').either.Either<E, A>
  type BatchId = string
  type GenerationId = import ('../model/job').GenerationId
  type SatisfiesBatchResult = import('.').SatisfiesBatchResult
  class SatisfiesWorker extends Worker {
    constructor();
    satisfiesBatch(path: Path<ConstrainedBid>, batchId: BatchId, generationId: GenerationId, openerDirection?: Direction, responderDirection?: Direction): Promise<Either<string, SatisfiesBatchResult>>;
    satisfies(path: Path<ConstrainedBid>, opener: SerializedHand, responder: SerializedHand): Promise<boolean>;
  }
  export = SatisfiesWorker;
}

declare module 'comlink-loader!./dds.worker' {
  type DoubleDummyResult = import ("./dds.worker").DoubleDummyResult
  type SerializedBoard = import ("../model/serialization").SerializedBoard
  type Either<E, A> = import ('fp-ts').either.Either<E, A>
  class DDSWorker extends Worker {
    constructor();
    getResult(board: SerializedBoard): Promise<Either<string, DoubleDummyResult>>;
  }
  export = DDSWorker;
}

declare module 'comlink-loader!./sat.worker' {
  type Either<E, A> = import ('fp-ts').either.Either<E, A>
  type Path<A> = import ("../model/system").Path<A>
  type ConstrainedBid = import ("../model/system/core").ConstrainedBid
  type Bid = import ("../model/bridge").Bid

  class SATWorker extends Worker {
    constructor();
    getPathIsSound(path: Path<ConstrainedBid>): Promise<Either<Path<Bid>, void>>;
  }
  export = SATWorker;
}