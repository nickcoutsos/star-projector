import { Vector3, Matrix4 } from 'three'
import organizePolygons, { pointInPolygon } from './polygons'
import edgesFromPolygons from './edges'

export default class Topology {
  constructor(geometry, options={ up: 'face' }) {
    this.geometry = geometry.clone()

    if (options.up === 'face') {
      const normal = this.geometry.faces[0].normal.clone().normalize()
      const up = new Vector3(0, 1, 0)
      const angle = normal.angleTo(up)
      const cross = normal.clone().cross(up).normalize()
      this.geometry.applyMatrix(new Matrix4().makeRotationAxis(cross, angle))
      this.geometry.computeFaceNormals()
    }

    this.vertices = this.geometry.vertices.map((v, index) => Object.assign(v.clone(), {index}))

    const polygons = organizePolygons(this.geometry.faces, this.vertices)
    const polygon = polygons[0]
    const edges = edgesFromPolygons(polygons)

    edges.forEach((edges, i) => polygons[i].edges = edges)

    this.polygons = polygons
    this.dihedral = polygon.plane.normal.angleTo(polygon.edges[0].shared.poly.plane.normal)
    this.faceRadius = polygon.center.length()
    this.edges = [].concat(...edges).reduce((edges, edge) => {
      if (!edges.find(({id}) => id === edge.id)) {
        edges.push(edge)
      }
      return edges
    }, [])
  }

  findContainingPolygon(point) {
    return this.polygons.find(polygon => pointInPolygon(point, polygon))
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
