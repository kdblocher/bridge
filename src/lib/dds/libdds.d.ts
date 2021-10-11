/// <reference types="emscripten" />
export interface LibDDSModule extends EmscriptenModule {
	// Module.cwrap() will be available by doing this.
	// Requires -s "EXTRA_EXPORTED_RUNTIME_METHODS=['cwrap']"
	cwrap: typeof cwrap;
	_solve(board: string, trump: string, plays: number, playsPtr: number): string
	_generateDDTable(board: string): string
}
