interface PercentageProps {
  numerator: number
  denominator: number
  decimalPlaces?: number
}
const Percentage = ({ numerator, denominator, decimalPlaces }: PercentageProps) => {
  const m = Math.pow(10, decimalPlaces ?? 0)
  return <span>{Math.floor(numerator * (100 * m) / denominator) / m}%</span>
}

export default Percentage