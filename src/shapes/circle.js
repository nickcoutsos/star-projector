import {CubicBezierCurve3, CurvePath, Vector3} from 'three'

// http://spencermortensen.com/articles/bezier-circle/
const c = 0.551915024494
const curves = [
  [ [ 0,  1], [ c,  1], [ 1,  c], [ 1,  0] ],
  [ [ 1,  0], [ 1, -c], [ c, -1], [ 0, -1] ],
  [ [ 0, -1], [-c, -1], [-1, -c], [-1,  0] ],
  [ [-1,  0], [-1,  c], [-c,  1], [ 0,  1] ]
]

export const makeCircle = radius => (
  curves.map(curve => {
    const points = curve.map(p => new Vector3(...p).multiplyScalar(radius))
    return new CubicBezierCurve3(...points)
  }).reduce((path, curve) => {
    path.add(curve)
    return path
  }, new CurvePath())
)

export default makeCircle(0.002)
