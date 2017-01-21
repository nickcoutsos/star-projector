import {CubicBezierCurve} from 'three';
import {computeIntersections} from '../lib/bezier-intersection';


function interpolate(points, t) {
  return points
    .slice(0, points.length - 1)
    .map(
      (p, i) => p.clone().lerp(points[i + 1], t)
    );
}

/**
 * Find and return points of intersection between a line segment and this curve.
 *
 * @param {THREE.Line3} line (z component of each point is ignored)
 * @return {Array<float>} intersections (between 0 and 3)
 */
CubicBezierCurve.prototype.intersectLine = function(line) {
  let {v0, v1, v2, v3} = this;
  let {start, end} = line;

  return computeIntersections([v0, v1, v2, v3], [start, end]);
}


/**
 * Split the curve into two at the point given by `t`.
 *
 * New control points are generated so that the new curves both align with the
 * original.
 *
 * @param {float} t
 * @returns {Array<CubicBezierCurve>}
 */
CubicBezierCurve.prototype.splitAt = function(t) {
  let [A, B, C, D] = [this.v0, this.v1, this.v2, this.v3],
    [E, F, G] = interpolate([A, B, C, D], t),
    [H, J] = interpolate([E, F, G], t),
    K = interpolate([H, J], t);

  return [
    new CubicBezierCurve(A, E, H, K),
    new CubicBezierCurve(K, J, G, D)
  ];
  // let [A, B, C, D] = [this.v0, this.v1, this.v2, this.v3];
  //
  // let [E, F, G] = [
  //   A.clone().lerp(B, t),
  //   B.clone().lerp(C, t),
  //   C.clone().lerp(D, t)
  // ];
  //
  // let [H, J] = [
  //   E.clone().lerp(F, t),
  //   F.clone().lerp(G, t)
  // ];
  //
  // let K = H.clone().lerp(t);
  //
}
