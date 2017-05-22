import organizePolygons, { pointInPolygon } from './polygons'
import edgesFromPolygons from './edges'

export default class Topology {
  constructor(geometry) {
    this.geometry = geometry
    this.vertices = geometry.vertices.map((v, index) => Object.assign(v.clone(), {index}))

    const polygons = organizePolygons(geometry.faces, this.vertices)
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
