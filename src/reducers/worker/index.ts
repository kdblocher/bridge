/* eslint-disable import/no-webpack-loader-syntax */

import Worker from 'comlink-loader!./worker'; // inline loader

const makeGenDealsTask = (count: number) => () => new Worker().genDeals(count)
export default makeGenDealsTask;