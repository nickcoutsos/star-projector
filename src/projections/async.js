import projectLine from './line'
import projectPath from './path'
import projectVector from './vector'

/**
 * Project a vector onto a topology.
 *
 * Essentially ray-casting with resulting polygon
 *
 * @param {Object} topology
 * @param {three.Vector3} vector
 * @param {three.Vector3} [origin=Vector3(0,0,0)]
 * @resolves {Object} ({point, polygonId})
 */
export function vector(topology, vector) {
  return Promise.resolve(
    projectVector(topology, vector)
  )
}

/**
 * Project a line connecting two projected points onto the topology.
 *
 * This function serves to handle situations involving points that lie on
 * separate polygons and must be connected with multiple line segments.
 *
 * @param {Vector3} a
 * @param {Vector3} b
 * @returns {Array<Object>} segments - an array of one or more line segments
 *  described as {polygon, edge} where `edge` is an array of two points and
 *  `polygon` is the index of the polygon in `topology` on which they lie.
 */
export function line(topology, a, b) {
  return Promise.resolve(
    projectLine(topology, a, b)
  )
}

/**
 * Project a path made up of cubic bezier curves against the topology
 *
 * @param {CurvePath} path
 * @param {Vector3} direction
 * @resolves {Array<three.CurvePath>} array of projected paths (with added `polygonId` property)
 */
export function path(topology, path, direction, options) {
  return Promise.resolve(
    projectPath(topology, path, direction, options)
  )
}

export default {
	line,
	path,
	vector
}
