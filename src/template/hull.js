import hull from 'convexhull-js'
import { Matrix4, Vector3 } from 'three'

const X = new Vector3(1, 0, 0)

const getUnfoldedEdges = polygons => [].concat(
  ...polygons.map(({ matrix, polygon }) => (
    polygon.edges.map(edge => edge.line
      .clone()
      .applyMatrix4(matrix)
    )
  ))
)

export const getUnfoldedHull = polygons => (
  hull([].concat(
    ...getUnfoldedEdges(polygons).map(edge => edge.toPoints())
  ))
)

/**
 * Make a rotation matrix to align the longest edge of a hull with the X-axis
 *
 * @param {Array<Vector3>}
 * @returns {Matrix4}
 */
export const getOrientationMatrix = points => {
  const longestEdge = points
    .map((v, i, arr) => ([v, arr[(i+1) % arr.length]]))
    .map(edge => new Vector3().subVectors(...edge))
    .reduce((a, b) => b.lengthSq() > a.lengthSq() ? b : a)

  const angle = longestEdge.angleTo(X)
  const cross = longestEdge.clone().cross(X)

  return new Matrix4().makeRotationZ(
    // angleTo gives us the smallest angle, so we check the cross product
    // to find out if we ought to rotate in the opposite direction
    cross.z > 1e-6
      ? angle
      : -angle
    )
}
