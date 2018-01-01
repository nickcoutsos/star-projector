const coords = ({x, y}) => `${x},${y}`
const moveTo = point => `M ${coords(point)}`
const lineTo = point => `L ${coords(point)}`
const curveTo = points => `C ${points.map(coords).join(' ')}`

export const line = ([ a, b ]) => `${moveTo(a)} ${lineTo(b)}`

export const path = ({ curves }) => {
  const curvePoints = curves.map(curve => curve.getControlPoints())
  const [first, ...rest] = [].concat(...curvePoints)

  // These paths are chained together in one curveTo, which makes every
  // fourth coordinate redundant in the directive, so remove it.
  const filtered = rest.filter((_, i) => i % 4 !== 3)

  const path = `${moveTo(first)} ${curveTo(filtered)}`
  return path
}

export const poly = ([first, ...rest], close=false) => (
  `${moveTo(first)} ${rest.map(lineTo).join(' ')} ${close ? 'Z' : ''}`
)
