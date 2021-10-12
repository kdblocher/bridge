declare module 'comlink-loader!./deal.worker' {
  type SerializedDeal = import ("../model/serialization").SerializedDeal
  class DealWorker extends Worker {
    constructor();
    genDeals(count: number): Promise<ReadonlyArray<SerializedDeal>>;
  }
  export = DealWorker;
}

declare module 'comlink-loader!./dds.worker' {
  type DoubleDummyResult = import ("../model/analyze").DoubleDummyResult
  type SerializedBoard = import ("../model/serialization").SerializedBoard
  class DDSWorker extends Worker {
    constructor();
    getResult(board: SerializedBoard): Promise<DoubleDummyResult>;
  }
  export = DDSWorker;
}