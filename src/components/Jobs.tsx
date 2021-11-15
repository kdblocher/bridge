import { option } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import { useCallback, useMemo } from 'react';
import TimeAgo from 'react-timeago';
import styled from 'styled-components';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { DateNumber, Job } from '../model/job';
import { removeJob, startJob } from '../reducers/generator';

interface DateViewProps {
  date: option.Option<DateNumber>
}
const DateView = ({ date }: DateViewProps) => {
  return <>{date._tag === "Some" && <TimeAgo date={(new Date(date.value))} />}</>
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
  job: Job
}
const JobView = ({ job }: JobViewProps) => {
  const progress = useMemo(() =>
    pipe(job.type.progress, p => p._tag === "None" ? null : {
      updateDate: p.value.updateDate,
      unitsDone: p.value.unitsDone
    }), [job.type.progress])
  const dispatch = useAppDispatch()
  const onRemoveClick = useCallback(() => dispatch(removeJob(job.id)), [dispatch, job.id])
  const onStartClick = useCallback(() => dispatch(startJob({ jobId: job.id, type: job.type.type })), [dispatch, job.id, job.type.type])
  return (
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
        Progress: {job.unitsInitial - progress.unitsDone} units remaining ({Math.floor(progress.unitsDone * 100 / job.unitsInitial)}%)
      </p>}
    </JobListItem>
  )
}

const Jobs = () => {
  const jobs = useAppSelector(state => state.generator.jobs)
  return (
    <section>
      <h3>Jobs</h3>
      <JobList>
        {jobs.map(j => <JobView key={j.id} job={j} />)}
      </JobList>
    </section>
  )
}

export default Jobs