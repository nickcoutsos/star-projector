import {Box3, Line3, Plane, Ray, Triangle, Vector3} from 'three';

const EPSILON = 0.000001;

/**
 * Collect topological details about the given geometry.
 *
 * More specifically; instead of THREE.Face, a triangle, an array of polygons
 * is returned. Each polygon is a collection of the original geometry's faces
 * that share the same normal vector, and includes:
 *  `normal`: the common normal vector for one or more faces
 *  `faces`: an array of the original geometry's Face objects for the shared normal
 *  `center`: a Vector3 representing the center of the polygon
 *  `edges`: an ordered array of circularly linked edge objects
 *
 * @param {THREE.Geometry} geometry
 * @returns {Object} {polygons, edges}
 */
export function getTopology(geometry) {
  let polygons = collectPlanarPolygons(geometry);

  polygons.forEach(p => p.edgeIndex = {});
  polygons.forEach(p => {
    p.center = p.vertices.reduce((a, b) => new Vector3().addVectors(a, b)).divideScalar(p.vertices.length);
    p.vertices = orderPolygonVertices(p.normal, p.vertices);
    p.boundingBox = new Box3().setFromPoints(p.vertices);
    p.edges = p.vertices.map((vertex, i, vertices) => {
      let next = vertices[i + 1] || vertices[0];
      return {
        index: i,
        id: [vertex.index, next.index].sort((a, b) => a - b).join('-'),
        point: vertex.clone(),
        line: new Line3(vertex, next),
        vector: new Vector3().subVectors(next, vertex).normalize(),
        poly: p
      };
    });

    p.edges.forEach((e, i, edges) => {
      e.next = edges[e.index + 1] || edges[0];
      e.prev = edges[e.index - 1] || edges[edges.length - 1];
    });
  });

  let edgeIndex = polygons.reduce((index, {edges}) => {
    edges.forEach(edge => {
      if (!index[edge.id]) index[edge.id] = [];
      index[edge.id].push(edge);
    });
    return index;
  }, {});

  polygons.forEach(polygon => {
    polygon.edges
      .filter(edge => edge.shared === undefined)
      .forEach(edge => {
        edge.shared = edgeIndex[edge.id].find(e => e != edge);
        edge.shared.shared = edge;
      });
  });


  return {
    dihedral: polygons[0].normal.angleTo(polygons[0].edges[0].shared.poly.normal),
    faceRadius: polygons[0].center.length(),
    edges: Object.keys(edgeIndex).map(k => edgeIndex[k][0]),
    polygons
  };
}


/**
 * For a given geometry group its faces by their normal vectors.
 *
 * @param {THREE.Geometry} geometry
 * @param {Array<Object>} polygons [{index, normal, faces}]
 */
export function collectPlanarPolygons(geometry) {
  return geometry.faces.reduce((polygons, face) => {
    let polygon = polygons.find(polygon => polygon.normal.angleTo(face.normal) < EPSILON),
      facePoints = ['a', 'b', 'c'].map(n => geometry.vertices[face[n]]);

    if (!polygon) polygons.push(polygon = {
      index: polygons.length,
      normal: face.normal.clone(),
      plane: new Plane().setFromNormalAndCoplanarPoint(face.normal, facePoints[0]),
      triangles: [],
      vertices: []
    });

    polygon.triangles.push(new Triangle(...facePoints));
    polygon.vertices.push(
      ...facePoints.filter(v => polygon.vertices.indexOf(v) === -1)
    );

    return polygons;
  }, []);
}


/**
 * Order an array of vertices around their central point.
 *
 * @param {Vector3} normal
 * @returns {Array<Vector3>} ordered array of points
 */
export function orderPolygonVertices(normal, points) {
  let center = points
      .reduce((a, b) => new Vector3().addVectors(a, b))
      .divideScalar(points.length);

  let vectors = points.map(p => ({p, vector: new Vector3().subVectors(p, center)}));
  vectors.forEach(v => {
    v.angle = v.vector.angleTo(vectors[0].vector);
    if (new Vector3().crossVectors(vectors[0].vector, v.vector).angleTo(normal) > EPSILON) {
      v.angle = 2*Math.PI - v.angle;
    }
  });

  vectors.sort((a, b) => a.angle - b.angle);
  return vectors.map(({p}) => p);
}


/**
 * Follow directions of a net to generate a tree of visited polygons in a topology
 *
 * @param {Object} source - an edge or polygon from which to begin following directions
 * @param {Array<Object>} directions - an array of one or more edges to follow in the given polygon and further directions to take from there.
 * @returns {Array<Object>} polygons
 */
export function travel(source, next) {
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

      return travel(target.shared, n.next || []);
    })
  }
}


/**
 * Test for a point's presence in a polygon.
 *
 * This includes testing for the point's presence in one of the polygon's
 * face(s) after already verifying the point is coplanar with the polygon.
 *
 * @param {Vector3} point
 * @param {Object} topology
 * @returns {Boolean}
 */
export function pointInPolygon(point, {plane, triangles}) {
  return (
    Math.abs(plane.distanceToPoint(point)) < EPSILON &&
    triangles.some(triangle => triangle.containsPoint(point))
  );
}


/**
 * Find which polygon in the given topolyg contains the given point.
 *
 * @param {Object} topology
 * @param {Vector3} point
 * @returns {Object} polygon
 */
export function findContainingPolygon(topology, point) {
  return topology.polygons.find(polygon => pointInPolygon(point, polygon));
}


/**
 * Determine where, if at all, a vector intersects with the given topology.
 *
 * @param {Vector3} vector
 * @param {Object} topology
 * @returns {Object|false} intersection {point, polygon}
 */
export function projectVector(vector, topology) {
  let ray = new Ray(new Vector3(), vector);
  let point, polygon = topology.polygons.find(polygon => {
    point = ray.intersectPlane(polygon.plane);
    return point && pointInPolygon(point, polygon) && point;
  });

  return polygon && {polygon, point};
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
export function projectLineSegment(topology, a, b) {
  let polygonA = findContainingPolygon(topology, a),
    polygonB = findContainingPolygon(topology, b);

  // If both points are on the same polygon a straight line can connect them.
  if (polygonA === polygonB) {
    return [{polygon: polygonA.index, edge: [a, b]}];
  }

  // If the points lie in adjacent polygons we use them with the origin to
  // describe a plane, and find the intersection of this plane with the common
  // edge of the adjacent polygons.
  let coplane = new Plane(new Vector3().crossVectors(a, b), 0),
    common = polygonA.edges.find(e => e.shared.poly.index == polygonB.index);

  if (common) {
    let connection = new Ray(common.point, common.vector.clone()).intersectPlane(coplane);
    return [
      {polygon: polygonA.index, edge: [a, connection]},
      {polygon: polygonB.index, edge: [b, connection]}
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
          coplane.normal.angleTo(new Vector3().crossVectors(a, point)) < EPSILON &&
          coplane.normal.angleTo(new Vector3().crossVectors(point, b)) < EPSILON
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
  let segments = [ {polygon: polygonA.index, edge: [a, intersections[0].point]} ];

  intersections.slice(0, -1).forEach(({edge, point}, i) => {
    let next = intersections[i + 1];
    segments.push({ polygon, edge: [point, next.point] });

    polygon = next.edge.poly.index === polygon ? next.edge.shared.poly.index : next.edge.poly.index;
  });

  segments.push({ polygon: polygonB.index, edge: [segments[segments.length-1].edge[1], b] });
  return segments;
}
