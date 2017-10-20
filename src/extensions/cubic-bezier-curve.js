import {CubicBezierCurve3} from 'three';
import './vector'
import Bezier from 'bezier-js'

function interpolate(points, t) {
  const interpolated = points
    .slice(0, points.length - 1)
    .map(
      (p, i) => p.clone().lerp(points[i + 1].clone(), t)
    );

  return interpolated
}

CubicBezierCurve3.prototype.toArray = function() {
  return this.getControlPoints().map(point => point.toArray())
}

CubicBezierCurve3.prototype.getControlPoints = function() {
  return [
    this.v0,
    this.v1,
    this.v2,
    this.v3
  ]
}

CubicBezierCurve3.prototype.applyMatrix4 = function(matrix) {
  this.getControlPoints().forEach(point => point.applyMatrix4(matrix))
  return this
}

CubicBezierCurve3.prototype.clone = function() {
  return new CubicBezierCurve3(...this.getControlPoints().map(v => v.clone()))
}

/**
 * Find and return points of intersection between a line segment and this curve.
 *
 * @param {THREE.Line3} line (z component of each point is ignored)
 * @return {Array<float>} intersections (between 0 and 3)
 */
CubicBezierCurve3.prototype.intersectLine = function(line) {
  let {v0, v1, v2, v3} = this;
  let {start, end} = line;

  return new Bezier(v0, v1, v2, v3)
    .intersects({p1: start, p2: end})
    .sort((a, b) => a - b)
    .map(t => ({t}))
    .filter(({t}) => {
      const point = this.getPointAt(t)
      return lineContainsPoint(line, point)
    })
}

/**
 * Determine whether or not a given point exists on a line segment
 *
 * This function does not test for intersections. Instead it checks the point
 * parameter of the line that would generate the given point (the closest point
 * on the line to the target, assuming that the point is on the line already)
 * and confirms that the parameter is within bounds.
 *
 * @param {three.Line3} line
 * @param {three.Vector3} point
 * @returns {Boolean}
 */
function lineContainsPoint(line, point) {
  const t = line.closestPointToPointParameter(point)
  return t > 0 && t < 1
}


/**
 * Split the curve into two at the point given by `t`.
 *
 * New control points are generated so that the new curves both align with the
 * original.
 *
 * @param {float} t
 * @returns {Array<CubicBezierCurve3>}
 */
CubicBezierCurve3.prototype.splitAt = function(t) {
  let [A, B, C, D] = [this.v0, this.v1, this.v2, this.v3],
    [E, F, G] = interpolate([A, B, C, D], t),
    [H, J] = interpolate([E, F, G], t),
    [K] = interpolate([H, J], t);

  return [
    new CubicBezierCurve3(A, E, H, K),
    new CubicBezierCurve3(K, J, G, D)
  ];
}
