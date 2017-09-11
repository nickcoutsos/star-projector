import {CubicBezierCurve3, CurvePath, Vector3} from 'three'

const polar = (r, t) => new Vector3(r*Math.cos(t), r*Math.sin(t), 0)

const bezierStar = (numPoints, radius, innerRadius) => {
  if (!innerRadius) {
    innerRadius = radius * 0.5
  }

  const b = Math.PI / 2
  const a = 2 * Math.PI / numPoints
  const aN = a / numPoints

  return '-'.repeat(numPoints - 1).split('-')
    .map((_,i) => new CubicBezierCurve3(
      polar(radius, b + i * a),
      polar(innerRadius, b + i * a + aN),
      polar(innerRadius, b + i * a + aN + aN),
      polar(radius, b + (i + 1) * a)
    ))
    .reduce(
      (path, curve) => (path.add(curve), path),
      new CurvePath()
    )
}

export default bezierStar
export const fourPointStar = bezierStar(4, 1)
export const fivePointStar = bezierStar(5, .008)
