declare module 'comlink-loader!*' {
  type SerializedDeal = import ("../../model/serialization").SerializedDeal
  class WebpackWorker extends Worker {
    constructor();
    genDeals(count: number): Promise<ReadonlyArray<SerializedDeal>>;
  }

  export = WebpackWorker;
}