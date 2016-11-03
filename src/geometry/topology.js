import {Plane, Triangle, Vector3} from 'three';

const CYCLE = (array, index) => array[(array.length + index) % array.length];
const EDGE_ID = pair => pair.slice().sort((a, b) => a - b).join('-');

/**
 * Collect topological details about the given geometry.
 *
 * More specifically; instead of THREE.Face, a triangle, an array of polygons
 * is returned. Each polygon is a collection of the original geometry's faces
 * that share the same normal vector, and includes:
 *  `normal`: the common normal vector for one or more faces
 *  `faces`: an array of the original geometry's Face objects for the shared normal
 *  `vertices`: an ORDERED array of vertex indices
 *  `center`: a Vector3 representing the center of the polygon
 *  `edges`: an ordered array of circularly linked edge objects
 *
 * @param {THREE.Geometry} geometry
 * @returns {Object} {polygons, vertices, edges}
 */
export function getTopology(geometry) {
  let {vertices} = geometry;
  let polygons = collectPlanarPolygons(geometry);

  polygons.forEach(p => p.edgeIndex = {});
  polygons.forEach(p => {
    p.center = p.vertices.map(n => vertices[n]).reduce((a, b) => new Vector3().addVectors(a, b)).divideScalar(p.vertices.length);
    p.vertices = orderPolygonVertices(p.normal, p.vertices, vertices);
    p.edges = p.vertices.map((v, i, indices) => ({
      index: i,
      id: EDGE_ID([v, CYCLE(indices, i+1)]),
      point: vertices[v].clone(),
      vector: new Vector3().subVectors(
        vertices[CYCLE(indices, i+1)],
        vertices[v]
      ).normalize(),
      poly: p
    }));

    p.edges.forEach((e, i, edges) => {
      e.next = CYCLE(edges, e.index+1);
      e.prev = CYCLE(edges, e.index-1);
    });
  });

  let edgeIndex = polygons.reduce((index, {edges}) => {
    edges.forEach(edge => {
      if (!index[edge.id]) index[edge.id] = [];
      index[edge.id].push(edge);
    });
    return index;
  });

  polygons.forEach(polygon => {
    polygon.edges
      .filter(edge => edge.shared === undefined)
      .forEach(edge => {
        edge.shared = edgeIndex[edge.id].find(e => e != edge);
        edge.shared.shared = edge;
      });
  });


  return {
    vertices: vertices.slice(),
    dihedral: polygons[0].normal.angleTo(polygons[0].edges[0].shared.poly.normal),
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
    let polygon = polygons.find(polygon => polygon.normal.angleTo(face.normal) < 0.01);
    if (!polygon) polygons.push(polygon = {
      index: polygons.length,
      normal: face.normal.clone(),
      plane: planeFromFace(face, geometry),
      faces: [],
      vertices: []
    });

    polygon.faces.push(Object.assign(face.clone(), {vertices: getPointsFromFace(face, geometry)}));
    polygon.vertices.push(
      ...['a','b','c']
        .map(n => face[n])
        .filter(n => polygon.vertices.indexOf(n) === -1)
    );

    return polygons;
  }, []);
}


/**
 * Return an array of the given polygon's vertices in order.
 *
 * @param {Object} polygon
 * @returns {Array<Integer>} ordered array of vertex indices
 */
export function orderPolygonVertices(normal, indices, vertices) {
  let points = indices.map(v => vertices[v]),
    center = points
      .reduce((a, b) => new Vector3().addVectors(a, b))
      .divideScalar(indices.length);

  points = points.map((v, i) => ({index: indices[i], vertex: v, vector: new Vector3().subVectors(v, center)}));
  points.forEach(p => {
    let angle = p.vector.angleTo(points[0].vector),
      cross = new Vector3().crossVectors(points[0].vector, p.vector);

    if (cross.angleTo(normal) > 0.01) angle = 2*Math.PI - angle;
    p.angle = angle;
  });

  points.sort((a, b) => a.angle - b.angle);
  return points.map(p => p.index);
}


function planeFromFace(face, geometry) {
  return new Plane().setFromCoplanarPoints(
    ...getPointsFromFace(face, geometry)
  );
}

/**
* Resolve vertex indices of a face from the given geometry
*
* @param {THREE.Face} face
* @param {THREE.Geometry} geometry
* @returns {Array<THREE.Vector3>}
*/
export function getPointsFromFace(face, geometry) {
  return [
    geometry.vertices[face.a],
    geometry.vertices[face.b],
    geometry.vertices[face.c],
  ];
}
