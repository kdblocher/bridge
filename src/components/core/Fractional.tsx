interface FractionalProps {
  numerator: number
  denominator: number
  decimalPlaces?: number
}
const Fractional = ({ numerator, denominator, decimalPlaces }: FractionalProps) => {
  const m = Math.pow(10, decimalPlaces ?? 0)
  return <span>1 in {Math.floor(denominator / numerator * m) / m}</span>
}

export default Fractional