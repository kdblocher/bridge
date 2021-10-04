declare module 'comlink-loader!*' {
  type Deal = import ("../../model/bridge").Deal
  class WebpackWorker extends Worker {
    constructor();
    genDeals(count: number): Promise<ReadonlyArray<Deal>>;
  }

  export = WebpackWorker;
}