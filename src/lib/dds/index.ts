import { LibDDSModule } from "./libdds"

declare const Module: LibDDSModule

Module['onRuntimeInitialized'] = function() {
  Module['_solve'] = Module.cwrap('solve', 'string', ['string', 'string', 'number', 'number'])
  Module['_generateDDTable'] = Module.cwrap('generateDDTable', 'string', ['string'])
}

const dds = Module
export default dds