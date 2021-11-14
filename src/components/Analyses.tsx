import { number, option as O, readonlyArray as RA, readonlyNonEmptyArray as RNEA, readonlyRecord as RR, readonlyTuple, taskEither } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import { Fragment, useCallback, useMemo } from 'react';
import styled from 'styled-components';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { eqBid } from '../model/bridge';
import { Analysis, AnalysisId, Generation, getBidPathHash, newGenerationId } from '../model/job';
import { serializedBidPathL } from '../model/serialization';
import { Paths } from '../model/system';
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
  const dealCount = pipe(analysis.generations, RA.foldMap(number.MonoidSum)(g => g.dealCount))
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
      O.map(RR.toReadonlyArray),
      O.toNullable)
    , [generation.satisfies])
  const paths = useAppSelector(state => pipe(
    selectSelectedAnalysis(state.profile),
    O.map(a => a.paths),
    O.toNullable))
    
  const dispatch = useAppDispatch()

  const onSatisfiesClick = useCallback(() => paths && dispatch(scheduleJob({
    analysisId: analysisId,
    type: "Satisfies",
    parameter: paths,
    context: { generationId: generation.id },
    estimatedUnitsInitial: paths.length * generation.dealCount
  })), [analysisId, dispatch, generation.dealCount, generation.id, paths])

  const onSolveClick = useCallback(sPath => pipe(sPath,
    serializedBidPathL.reverseGet,
    path => pipe(paths,
      O.fromNullable,
      O.chain(RA.findFirst(flow(
        RNEA.map(cb => cb.bid),
        p => RNEA.getEq(eqBid).equals(p, path))))),
    O.map(path => pipe(
      getDealsWithSolutionsByPath(generation.id, getBidPathHash(path)),
      taskEither.map(flow(
        RR.filter(d => O.isNone(d.solution)),
        RR.map(d => d.deal),
        RR.toReadonlyArray,
        RA.map(readonlyTuple.snd),
        deals => dispatch(scheduleJob({
          analysisId: analysisId,
          type: "Solve",
          parameter: deals,
          context: { generationId: generation.id, bidPath: sPath },
          estimatedUnitsInitial: deals.length
        })))))()))
    , [analysisId, dispatch, generation.id, paths])

  return (
    <li>
      Deal Count: {generation.dealCount} <br/>
      {satisfies === null && <button onClick={onSatisfiesClick}>Satisfies</button>}
      {satisfies !== null && <StatsPathContainer>
        {satisfies.map(([path, count]) =>
          <Fragment key={path}>
            <StatsPath path={path} satisfiesCount={count} dealCount={generation.dealCount} />
            <span>
              <button onClick={() => onSolveClick(path)}>Solve</button>
              {pipe(
                generation.solutions,
                RR.lookup(path),
                O.map(flow(RR.toReadonlyArray, RA.map(readonlyTuple.snd), a => a.length)),
                O.chain(O.fromPredicate(len => len > 0)),
                O.fold(() => <></>, len => <>&nbsp;({len} so far)</>))}
            </span>
          </Fragment>
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
    O.toNullable))
  const selected = useAppSelector(state => pipe(selectSelectedAnalysis(state.profile), O.toNullable))
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
