import { number, option, readonlyArray, readonlyNonEmptyArray, readonlyRecord, taskEither } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import { useCallback, useMemo } from 'react';
import styled from 'styled-components';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { eqBid, makeBoard } from '../model/bridge';
import { Analysis, AnalysisId, Generation, getBidPathHash, newGenerationId } from '../model/job';
import { SerializedBidPath, serializedBidPathL, serializedBoardL, serializedDealL } from '../model/serialization';
import { Path, Paths } from '../model/system';
import { ConstrainedBid } from '../model/system/core';
import { scheduleJob } from '../reducers/generator';
import { addAnalysis, deleteAnalysis, selectAllAnalyses, selectAnalysis, selectSelectedAnalysis, setAnalysisName } from '../reducers/profile';
import { selectValidConstrainedBidPaths } from '../reducers/system';
import { getDealsWithSolutionsByPath } from '../services/idb';
import StatsPath from './stats/StatsPath';

const AnalysisList = styled.ul `
  display: flex;
  flex-flow: row wrap;
  list-style-type: none;
  padding: 0px;
  margin: 0px;
`
const AnalysisListItem = styled.li `
  padding: 0px;
  margin: 5px;
`

interface AnalysisProps {
  analysis: Analysis
}
const AnalysisView = ({ analysis }: AnalysisProps) => {
  const dispatch = useAppDispatch()
  const dealCount = pipe(analysis.generations, readonlyArray.foldMap(number.MonoidSum)(g => g.dealCount))
  const onRemoveClick = useCallback(() => dispatch(deleteAnalysis(analysis.id)), [analysis.id, dispatch])
  const onSelectClick = useCallback(() => dispatch(selectAnalysis(analysis.id)), [analysis.id, dispatch])
  const onNameChange = useCallback(name => dispatch(setAnalysisName(analysis.id, name)), [analysis.id, dispatch])
  return (
    <AnalysisListItem>
      <input type="text" value={analysis.name} onChange={e => onNameChange(e.target.value)} />
      <p>
        Paths: {analysis.paths.length} <br />
        Deals: {dealCount} <small>({analysis.generations.length} generations)</small><br />
      </p>
      <button onClick={onSelectClick}>Select</button>
      <button onClick={onRemoveClick}>Remove</button>
    </AnalysisListItem>
  )
}

const StatsPathContainer = styled.div `
  clear: both;
  display: inline-grid;
  grid-column-gap: 5px;
  grid-template-columns: auto auto auto;
  width: auto;
`

interface GenerationViewProps {
  analysisId: AnalysisId
  generation: Generation
}
const GenerationView = ({ analysisId, generation }: GenerationViewProps) => {
  const satisfies = useMemo(() =>
    pipe(generation.satisfies,
      option.map(readonlyRecord.toReadonlyArray),
      option.toNullable)
    , [generation.satisfies])
  const paths = useAppSelector(state => pipe(
    selectSelectedAnalysis(state.profile),
    option.map(a => a.paths),
    option.toNullable))
    
  const dispatch = useAppDispatch()

  const onSatisfiesClick = useCallback(() => paths && dispatch(scheduleJob({
    analysisId: analysisId,
    type: "Satisfies",
    parameter: paths,
    context: { generationId: generation.id },
    estimatedUnitsInitial: paths.length * generation.dealCount
  })), [analysisId, dispatch, generation.dealCount, generation.id, paths])

  const onSolveClick = useCallback(sbp => pipe(sbp,
    serializedBidPathL.reverseGet,
    path => pipe(paths,
      option.fromNullable,
      option.chain(readonlyArray.findFirst(flow(readonlyNonEmptyArray.map(cb => cb.bid), bids => readonlyNonEmptyArray.getEq(eqBid).equals(bids, path))))),
    option.map(path => pipe(
      getDealsWithSolutionsByPath(generation.id, getBidPathHash(path)),
      taskEither.map(flow(
        readonlyArray.filter(d => option.isNone(d.solution)),
        readonlyArray.map(d => d.deal),
        readonlyArray.mapWithIndex((i, d) => pipe(d,
          serializedDealL.reverseGet,
          makeBoard(i),
          serializedBoardL.get)),
        boards => dispatch(scheduleJob({
          analysisId: analysisId,
          type: "Solve",
          parameter: boards,
          context: { generationId: generation.id },
          estimatedUnitsInitial: boards.length
        })))))()))
    , [analysisId, dispatch, generation.id, paths])

  return (
    <li>
      Deal Count: {generation.dealCount} <br/>
      {satisfies === null && <button onClick={onSatisfiesClick}>Satisfies</button>}
      {satisfies !== null && <StatsPathContainer>
        {satisfies.map(([path, count]) => <>
            <StatsPath key={path} path={path} satisfiesCount={count} dealCount={generation.dealCount} />
            <button onClick={() => onSolveClick(path)}>Solve</button>
          </>
        )}
      </StatsPathContainer>}
    </li>
  )
}

interface SelectedAnalysisViewProps {
  analysis: Analysis
}
const SelectedAnalysisView = ({ analysis }: SelectedAnalysisViewProps) => {
  const dispatch = useAppDispatch()
  const onGenerateDealsClick = useCallback((count: number) => dispatch(scheduleJob({
    analysisId: analysis.id,
    type: "GenerateDeals",
    context: { generationId: newGenerationId() },
    parameter: count,
    estimatedUnitsInitial: count
  })), [analysis.id, dispatch])
  const generateCount = useAppSelector(state => state.settings.generateCount)
  return (
    <div>
      <ul>
        {analysis.generations.map(g => <GenerationView analysisId={analysis.id} key={g.id} generation={g} />)}
      </ul>
      <button onClick={() => onGenerateDealsClick(generateCount)}>Generate Deals</button>
    </div>
  )
}

const Analyses = () => {
  const analyses = useAppSelector(state => selectAllAnalyses(state.profile))
  const dispatch = useAppDispatch()
  const onCreateClick = useCallback((paths: Paths<ConstrainedBid>) => dispatch(addAnalysis(paths)), [dispatch])
  const paths = useAppSelector(state => pipe(
    selectValidConstrainedBidPaths({ state: state.system, options: state.settings }),
    option.toNullable))
  const selected = useAppSelector(state => pipe(selectSelectedAnalysis(state.profile), option.toNullable))
  return (
    <section>
      <h3>Analyses</h3>
      <AnalysisList>
        {analyses.map(a => <AnalysisView key={a.id} analysis={a} />)}
      </AnalysisList>
      {paths && <button onClick={() => onCreateClick(paths)}>Create</button>}
      <h4>Selected</h4>
      {selected && <SelectedAnalysisView analysis={selected} />}
    </section>
  )
}

export default Analyses