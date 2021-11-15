import { option as O } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import { useCallback, useMemo } from 'react';
import TimeAgo from 'react-timeago';
import styled from 'styled-components';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { DateNumber, DateNumberB, estimatedTimeRemaining, getGenericProgress, JobId, now } from '../model/job';
import { removeJob, selectJobById, startJob } from '../reducers/generator';

interface DateViewProps {
  date: O.Option<DateNumber> | DateNumber
}
const DateView = ({ date }: DateViewProps) => {
  const value =
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

interface JobViewProps {
  jobId: JobId
}
const JobView = ({ jobId }: JobViewProps) => {
  const job = useAppSelector(state => pipe(selectJobById({ state: state.generator, jobId }), O.toNullable))
  const progress = useMemo(() => pipe(
    job,
    O.fromNullable,
    O.chain(getGenericProgress),
    O.toNullable)
    , [job])

  const dispatch = useAppDispatch()
  const onRemoveClick = useCallback(() => job && dispatch(removeJob(job.id)), [dispatch, job])
  const onStartClick = useCallback(() => job && dispatch(startJob({ jobId: job.id, type: job.type.type })), [dispatch, job])
  const timeRemaining = useMemo(() => pipe(
    job,
    O.fromNullable,
    O.chain(estimatedTimeRemaining),
    O.map(r => now() + r),
    O.chain(flow(DateNumberB.decode, O.fromEither))),
    [job])
  return (<>{job &&
    <JobListItem>
      <h5>{job.type.type}</h5>
      {!progress && <p>
        Estimated Units: {job.unitsInitial} <br />
        <button onClick={onStartClick}>Start</button>
        <button onClick={onRemoveClick}>Remove</button>
      </p>}
      {progress && <p>
        Started: <DateView date={job.startDate} /><br />
        Last Updated: <DateView date={progress.updateDate} /> <br />
        Progress: {job.unitsInitial - progress.unitsDone} units remaining ({Math.floor(progress.unitsDone * 100 / job.unitsInitial)}%) <br />
        Est. Time Remaining: <DateView date={timeRemaining} />
      </p>}
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