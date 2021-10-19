// Due to the way comlink-loader works, types cannot be imported at the top level, and must be imported via (import "...") statements.

declare module 'comlink-loader!./deal.worker' {
  type SerializedDeal = import ("../model/serialization").SerializedDeal
  class DealWorker extends Worker {
    constructor();
    genDeals(count: number): Promise<ReadonlyArray<SerializedDeal>>;
  }
  export = DealWorker;
}

declare module 'comlink-loader!./dds.worker' {
  type DoubleDummyResult = import ("./dds.worker").DoubleDummyResult
  type SerializedBoard = import ("../model/serialization").SerializedBoard
  class DDSWorker extends Worker {
    constructor();
    getResult(board: SerializedBoard): Promise<DoubleDummyResult>;
  }
  export = DDSWorker;
}