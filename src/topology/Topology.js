import {Ray, Vector3} from 'three'
import organizePolygons from './polygons'
import edgesFromPolygons from './edges'
import * as projections from './projections'

const EPSILON = 1e-6

export default class Topology {
  constructor(geometry) {
    this.geometry = geometry
    this.vertices = geometry.vertices.map((v, index) => Object.assign(v.clone(), {index}))

    const polygons = organizePolygons(geometry.faces, this.vertices)
    const polygon = polygons[0]
    edgesFromPolygons(polygons).forEach((edges, i) => polygons[i].edges = edges)

    this.polygons = polygons
    this.dihedral = polygon.normal.angleTo(polygon.edges[0].shared.poly.normal)
    this.faceRadius = polygon.center.length()
  }

  findContainingPolygon(point) {
    return this.polygons.find(polygon => pointInPolygon(point, polygon))
  }

  projectVector(vector) {
    let ray = new Ray(new Vector3(), vector);
    let point, polygon = this.polygons.find(polygon => {
      point = ray.intersectPlane(polygon.plane)
      return point && pointInPolygon(point, polygon) && point
    });

    return polygon && {polygon, point}
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
  projectLineSegment(a, b) {
    return projections.line(this, a, b)
  }

  /**
   * Project a path made up of cubic bezier curves against the topology
   *
   * @param {CurvePath} path
   * @param {Vector3} direction
   */
  projectCurvePath(path, direction) {
    return projections.path(this, path, direction)
  }

  travel(source, next) {
    let edge, poly;
    if (source.edges) {
      poly = source;
      edge = poly.edges[0];
    }
    else {
      edge = source;
      poly = edge.poly;
    }

    return {
      node: {edge, poly},
      children: [].concat(next).map(n => {
        let target;
        if (typeof n === 'number') target = poly.edges[n];
        else if (n.index !== undefined) target = poly.edges[n.index];
        else if (n.offset) target = poly.edges[(poly.edges.length + edge.index + n.offset) % poly.edges.length];
        else throw new Error('Expected relative edge offset property');

        return this.travel(target.shared, n.next || []);
      })
    }
  }
}

const pointInPolygon = (point, {plane, triangles}) => (
  Math.abs(plane.distanceToPoint(point)) < EPSILON &&
  triangles.some(triangle => triangle.containsPoint(point))
)
