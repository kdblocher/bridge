import { option as O } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import { useCallback, useMemo } from 'react';
import TimeAgo from 'react-timeago';
import styled from 'styled-components';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { get } from '../lib/object';
import { DateNumber, DateNumberB, estimatedTimeRemaining, getGenericProgress, JobId, now, ProgressData } from '../model/job';
import { removeJob, selectJobById, startJob } from '../reducers/generator';

interface DateViewProps {
  date: O.Option<DateNumber> | DateNumber | null
}
const DateView = ({ date }: DateViewProps) => {
  const value =
    !date ? null :
    typeof date === "number" ? date :
    date._tag === "Some" ? date.value :
    null
  return <>{value && <TimeAgo date={(new Date(value))} />}</>
}

const JobList = styled.ul `
  display: flex;
  flex-flow: row wrap;
  list-style-type: none;
  padding: 0px;
  margin: 0px;
`
const JobListItem = styled.li `
  padding: 0px;
  margin: 5px;
`

interface ProgressViewProps {
  start: DateNumber
  unitsInitial: number
  progress: ProgressData
}
const ProgressView = ({ progress, unitsInitial, start }: ProgressViewProps) => {
  const timeRemaining = useMemo(() => pipe(
    progress,
    estimatedTimeRemaining(unitsInitial),
    O.map(x => { console.log(x); return x }),
    O.map(r => now() + r),
    O.map(x => { console.log(x); return x }),
    O.chain(flow(DateNumberB.decode, O.fromEither)),
    O.toNullable)
    , [progress, unitsInitial])
  return (
    <p>
      Started: <DateView date={start} /><br />
      Last Updated: <DateView date={progress.updateDate} /> <br />
      Progress: {unitsInitial - progress.unitsDone} units remaining ({Math.floor(progress.unitsDone * 100 / unitsInitial)}%) <br />
      Est. Completion: <DateView date={timeRemaining} />
    </p>
  )
}

interface JobViewProps {
  jobId: JobId
}
const JobView = ({ jobId }: JobViewProps) => {
  const job = useAppSelector(state => pipe(selectJobById({ state: state.generator, jobId }), O.toNullable))
  const progress = pipe(job,
    O.fromNullable,
    O.chain(getGenericProgress),
    O.toNullable)
  const startDate = pipe(job,
    O.fromNullable,
    O.chain(get("startDate")),
    O.toNullable)
  const dispatch = useAppDispatch()
  const onRemoveClick = useCallback(() => job && dispatch(removeJob(job.id)), [dispatch, job])
  const onStartClick = useCallback(() => job && dispatch(startJob({ jobId: job.id, type: job.type.type })), [dispatch, job])
  return (<>{job &&
    <JobListItem>
      <h5>{job.type.type}</h5>
      {!progress && <p>
        Estimated Units: {job.unitsInitial} <br />
        <button onClick={onStartClick}>Start</button>
        <button onClick={onRemoveClick}>Remove</button>
      </p>}
      {progress && startDate && <ProgressView progress={progress} unitsInitial={job.unitsInitial} start={startDate} />}
    </JobListItem>
  }</>)
}

const Jobs = () => {
  const jobs = useAppSelector(state => state.generator.jobs)
  return (
    <section>
      <h3>Jobs</h3>
      <JobList>
        {jobs.map(j => <JobView key={j.id} jobId={j.id} />)}
      </JobList>
    </section>
  )
}

export default Jobs