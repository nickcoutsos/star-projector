import {Plane, Ray} from 'three'
import {pointInPolygon} from '../polygons'

const EPSILON = 1e-6

export default function projectLineSegment(topology, a, b) {
  const polygonA = topology.polygons.find(p => pointInPolygon(a, p)),//findContainingPolygon(a),
    polygonB = topology.polygons.find(p => pointInPolygon(b, p))//topology.findContainingPolygon(b);

  // If both points are on the same polygon a straight line can connect them.
  if (polygonA === polygonB) {
    return [{polygonId: polygonA.index, edge: [a, b]}];
  }

  // If the points lie in adjacent polygons we use them with the origin to
  // describe a plane, and find the intersection of this plane with the common
  // edge of the adjacent polygons.
  let coplane = new Plane(a.clone().cross(b), 0),
    common = polygonA.edges.find(e => e.shared.poly.index == polygonB.index);

  if (common) {
    let connection = new Ray(common.point, common.vector.clone()).intersectPlane(coplane);
    return [
      {polygonId: polygonA.index, edge: [a, connection]},
      {polygonId: polygonB.index, edge: [b, connection]}
    ];
  }

  // Find all point intersection between the topology's edges and the plane
  // defined by points `a`, `b`, and the origin excluding those which lie
  // outside of the arc of `a` and `b` (AxB should approximately equal AxP and
  // PxB for every P in the set of points found in the initial step.)
  let intersections = topology.edges
    .reduce((intersections, edge) => {
      let point = coplane.intersectLine(edge.line);
      if (point &&
          coplane.normal.angleTo(a.clone().cross(point)) < EPSILON &&
          coplane.normal.angleTo(point.clone().cross(b)) < EPSILON
        ) {
        intersections.push(({edge, point}));
      }

      return intersections;
    }, []);

  // Sort points by their angular distance to the edge closest to `a`.
  let start = intersections.find(({edge}) => polygonA.edges.find(({id}) => edge.id === id));
  intersections.forEach(intersection => intersection.angle = intersection.point.angleTo(start.point));
  intersections.sort((a, b) => a.angle - b.angle);

  // each intersection contains one point of a pair of line segments
  let polygon = intersections[0].edge.poly.index;
  if (polygon === polygonA.index) polygon = intersections[0].edge.shared.poly.index;
  let segments = [ {polygonId: polygonA.index, edge: [a, intersections[0].point]} ];

  intersections.slice(0, -1).forEach(({edge, point}, i) => {
    let next = intersections[i + 1];
    segments.push({ polygonId: polygon.index, edge: [point, next.point] });

    polygon = next.edge.poly.index === polygon ? next.edge.shared.poly.index : next.edge.poly.index;
  });

  segments.push({ polygonId: polygonB.index, edge: [segments[segments.length-1].edge[1], b] });
  return segments;
}
