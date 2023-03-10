import { number, option as O, readonlyArray as RA, readonlyRecord as RR, readonlyTuple, taskEither as TE } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import { Fragment, useCallback, useMemo, useState } from 'react';
import styled from 'styled-components';

import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, DialogTrigger } from '@fluentui/react-components';
import { ReadonlyNonEmptyArray } from 'fp-ts/lib/ReadonlyNonEmptyArray';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { get } from '../lib/object';
import { eqBid } from '../model/bridge';
import { AnalysisId, ConstrainedBidPathHash, Generation, GenerationId, getBidPathHash, newAnalysisId, newGenerationId } from '../model/job';
import { SerializedBidPath, serializedBidPathL } from '../model/serialization';
import { Path, Paths } from '../model/system';
import { ConstrainedBid } from '../model/system/core';
import { scheduleJob } from '../reducers/generator';
import { addAnalysis, deleteAnalysis, selectAllAnalyses, selectAnalysis, selectAnalysisById, selectGenerationByAnalysis, selectSelectedAnalysis, setAnalysisName } from '../reducers/profile';
import { selectValidConstrainedBidPaths } from '../reducers/system';
import { getDealsWithSolutionsByPath } from '../services/idb';
import SolutionStats from './stats/SolutionStats';
import StatsPath from './stats/StatsPath';
import StatsDetails from './stats/StatsDetails';
import BidPath from './core/BidPath';

const FlexList = styled.ul`
  display: flex;
  flex-flow: row wrap;
  list-style-type: none;
  padding: 0px;
  margin: 0px;
`
const FlexListItem = styled.li`
  padding: 0px;
  margin: 5px;
`

interface AnalysisProps {
  analysisId: AnalysisId
}
const AnalysisView = ({ analysisId }: AnalysisProps) => {
  const analysis = useAppSelector(state => pipe(
    selectAnalysisById({ state: state.profile, analysisId }),
    O.toNullable))
  const dispatch = useAppDispatch()
  const dealCount = !analysis ? 0 : pipe(analysis.generations, RA.foldMap(number.MonoidSum)(g => g.dealCount))
  const onRemoveClick = useCallback(() => dispatch(deleteAnalysis(analysisId)), [analysisId, dispatch])
  const onSelectClick = useCallback(() => dispatch(selectAnalysis(analysisId)), [analysisId, dispatch])
  const onNameChange = useCallback(name => dispatch(setAnalysisName(analysisId, name)), [analysisId, dispatch])
  return (<>{analysis &&
    <FlexListItem>
      <input type="text" value={analysis.name} onChange={e => onNameChange(e.target.value)} />
      <p>
        Paths: {analysis.paths.length} <br />
        Deals: {dealCount} <small>({analysis.generations.length} generations)</small><br />
      </p>
      <Button onClick={onSelectClick}>Select</Button>
      <Button onClick={onRemoveClick}>Remove</Button>
    </FlexListItem>
  }</>)
}

interface StatsPathItemProps {
  generationId: GenerationId
  analysisId: AnalysisId
  path: SerializedBidPath
  pathHash: ConstrainedBidPathHash
  count: number
}
const StatsPathItem = ({ path, count, generationId, analysisId, pathHash }: StatsPathItemProps) => {
  const generation = useAppSelector(state => pipe(
    selectGenerationByAnalysis({ state: state.profile, analysisId, generationId }),
    O.toNullable))
  const dispatch = useAppDispatch()
  const solve = useCallback(() => pipe(
    getDealsWithSolutionsByPath(generationId, pathHash),
    TE.map(flow(
      RR.filter(d => O.isNone(d.solution)),
      RR.map(d => d.deal),
      RR.toReadonlyArray,
      RA.map(readonlyTuple.snd),
      deals => dispatch(scheduleJob({
        analysisId: analysisId,
        type: "Solve",
        parameter: deals,
        context: { generationId: generationId, bidPath: path },
        estimatedUnitsInitial: deals.length
      })))))()
    , [analysisId, dispatch, generationId, path, pathHash])
  return (<>{generation && <>
    {/* Contained in CSS grid, so make sure the node count is consistent with StatsPathContainer CSS */}
    <StatsPath path={path} satisfiesCount={count} dealCount={generation.dealCount} />
    <StatsModal path={path} generation={generation} solve={solve} />
  </>}</>)
}

interface StatsModelProps {
  path: SerializedBidPath
  generation: Generation,
  solve: () => void
}
const StatsModal = ({ path, generation, solve }: StatsModelProps) => {
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const onShowClick = useCallback((open: boolean) => {
    if (open) {
      solve();
    }
    setShowDetails(open);
  }, [solve]);
  return <>
    <Dialog modalType='modal' open={showDetails} onOpenChange={(__, data) => onShowClick(data.open)}>
      <DialogTrigger>
        <Button>Details...</Button>
      </DialogTrigger>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Solution Details - <BidPath path={serializedBidPathL.reverseGet(path)} /></DialogTitle>
          <StatsDetails path={path} generation={generation} onClose={() => setShowDetails(false)} />
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary">Close</Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  </>
}

const StatsPathContainer = styled.div`
    clear: both;
    display: inline-grid;
    grid-column-gap: 5px;
    grid-template-columns: auto auto auto;
    width: auto;
    `

interface GenerationViewProps {
  analysisId: AnalysisId
  generationId: GenerationId
}
const GenerationView = ({ analysisId, generationId }: GenerationViewProps) => {
  const generation = useAppSelector(state => pipe(
    selectGenerationByAnalysis({ state: state.profile, analysisId, generationId }),
    O.toNullable))
  const satisfies = useMemo(() => pipe(
    generation,
    O.fromNullable,
    O.chain(get("satisfies")),
    O.map(RR.toReadonlyArray),
    O.toNullable)
    , [generation])
  const paths = useAppSelector(state => pipe(
    selectAnalysisById({ state: state.profile, analysisId }),
    O.map(get("paths")),
    O.toNullable))

  const dispatch = useAppDispatch()
  const onSatisfiesClick = useCallback(() => generation && paths && dispatch(scheduleJob({
    analysisId: analysisId,
    type: "Satisfies",
    parameter: paths,
    context: { generationId: generation.id },
    estimatedUnitsInitial: paths.length * generation.dealCount
  })), [analysisId, dispatch, generation, paths])

  const getHash = useCallback((path: SerializedBidPath) => pipe(
    paths,
    O.fromNullable,
    O.chain(RA.findFirst(flow(
      RA.map(get('bid')),
      bids => RA.getEq(eqBid).equals(bids, serializedBidPathL.reverseGet(path))))),
    O.map(getBidPathHash),
    O.toNullable
  ), [paths])

  return (<>{generation &&
    <FlexListItem>
      Deal Count: {generation.dealCount} <br />
      {satisfies && <StatsPathContainer>
        {satisfies.map(([path, count]) => {
          const pathHash = getHash(path)
          return (<Fragment key={path}>
            {pathHash && <StatsPathItem key={path} path={path} pathHash={pathHash} count={count} generationId={generationId} analysisId={analysisId} />}
          </Fragment>)
        })}
      </StatsPathContainer>}
    </FlexListItem>
  }</>)
}

const SelectedAnalysis = () => {
  const analysis = useAppSelector(state => pipe(selectSelectedAnalysis(state.profile), O.toNullable))
  const generateCount = useAppSelector(state => state.settings.generateCount)

  const dispatch = useAppDispatch()
  const onGenerateDealsClick = useCallback((count: number) => {
    if (analysis) {
      dispatch(scheduleJob({
        analysisId: analysis.id,
        type: "GenerateDeals",
        context: { generationId: newGenerationId() },
        parameter: count,
        estimatedUnitsInitial: count
      }))
    }
  }, [analysis, dispatch])

  return (<>{analysis &&
    <div>
      <h4>{analysis.name}</h4>
      <FlexList>
        {analysis.generations.map(g => <GenerationView key={g.id} analysisId={analysis.id} generationId={g.id} />)}
      </FlexList>
      <Button onClick={() => onGenerateDealsClick(generateCount)}>Generate Deals</Button>
    </div>
  }</>)
}

interface NewAnalysisProps {
  paths: ReadonlyNonEmptyArray<Path<ConstrainedBid>>
  onSubmitOrClose: () => void
}
const NewAnalysis = ({ paths, onSubmitOrClose }: NewAnalysisProps) => {
  const dispatch = useAppDispatch()
  const onGoClick = useCallback((name: string, count: number, paths: Paths<ConstrainedBid>) => {
    onSubmitOrClose()
    dispatch(addAnalysis({ id: newAnalysisId(), name, count, paths }))
  }, [dispatch, onSubmitOrClose])
  const defaultCount = useAppSelector(state => state.settings["generateCount"])
  const [name, setName] = useState<string>(`New analysis (${paths.length} paths)`)
  const [count, setCount] = useState<number>(defaultCount);
  return (
    <DialogContent>
      <p>
        Name <input type="text" value={name} onChange={e => setName(e.target.value)} />
        <br />
        Hands to Generate <input type="number" value={count} onChange={e => pipe(e.target.value, parseInt, setCount)} style={{ width: "100px" }} />
      </p>
      <DialogActions>
        <DialogTrigger disableButtonEnhancement>
          <Button appearance="secondary">Close</Button>
        </DialogTrigger>
        <Button appearance='primary' disabled={!paths} onClick={() => onGoClick(name, count, paths)}>Go</Button>
      </DialogActions>
    </DialogContent>
  )
}

const Analyses = () => {
  const [newAnalysis, setNewAnalysis] = useState<boolean>(false);
  const paths = useAppSelector(state => pipe(
    selectValidConstrainedBidPaths({ state: state.system, options: state.settings }),
    O.toNullable))
  return (
    <section>
      <h3>Analyses</h3>
      <SelectedAnalysis />
      {paths && (<>
        <Dialog modalType='modal' open={newAnalysis} onOpenChange={(__, data) => setNewAnalysis(data.open)}>
          <DialogTrigger>
            <Button>Start...</Button>
          </DialogTrigger>
          <DialogSurface>
            <DialogBody>
              <DialogTitle>New Analysis</DialogTitle>
              <NewAnalysis paths={paths} onSubmitOrClose={() => setNewAnalysis(false)} />
            </DialogBody>
          </DialogSurface>
        </Dialog>
      </>)}
    </section>
  )
}

export default Analyses

