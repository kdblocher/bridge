import { SerializedBidPath, serializedBidPathL } from '../../model/serialization';
import BidPath from '../core/BidPath';
import Fractional from '../core/Fractional';
import Percentage from '../core/Percentage';

interface StatsPathProps {
  path: SerializedBidPath
  satisfiesCount: number
  dealCount?: number
}
const StatsPath = ({ path, satisfiesCount, dealCount }: StatsPathProps) => {
  return (
    <>
      <BidPath path={serializedBidPathL.reverseGet(path)} />
      <span>
        {satisfiesCount}
        {dealCount && <small>
          &nbsp;(
          <Percentage numerator={satisfiesCount} denominator={dealCount} decimalPlaces={2} />
          &nbsp;,&nbsp;or&nbsp;
          <Fractional numerator={satisfiesCount} denominator={dealCount} />
          )
        </small>}
      </span>
    </>)
}

export default StatsPath