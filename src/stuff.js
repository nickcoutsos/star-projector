import {Plane, Ray, Triangle, Vector3} from 'three';

const NUMERIC_SORT = (a, b) => a - b;
const ID_FROM_PAIR = (a, b) => [a, b].sort(NUMERIC_SORT).join('-');
const ARRAY_CYCLE = (array, index) => array[(array.length + index) % array.length];
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


/**
*/
export function getGeometryMetadata(geometry) {
  let {vertices} = geometry;
  let polygons = collectPlanarPolygons(geometry);
  let edges = collectEdgesFromPolygons(polygons);

  polygons.forEach(p => p.edgeIndex = {});
  polygons.forEach(p => {
    p.vertices = orderPolygonVertices(p, geometry);
    // let len = p.vertices.length;
    // p.edges = new Array(len);
    p.edges = p.vertices.map((v, i, vertices) => ({
      index: i,
      id: ID_FROM_PAIR(v, ARRAY_CYCLE(vertices, i + 1)),
      poly: p
    }));

    p.edges.forEach((e, i, edges) => {
      e.next = ARRAY_CYCLE(edges, e.index + 1);
      e.prev = ARRAY_CYCLE(edges, e.index - 1);
      p.edgeIndex[e.id] = e;
    });

    // for (let i = 0; i < len; i++) {
    //   p.edges[i] = {
    //     index: i,
    //     id: [p.vertices[i], p.vertices[(i+1) % len]].sort((a,b) => a-b).join('-'),
    //     next: (i + 1) % len,
    //     prev: (i - 1) % len
    //   };
    //
    //   p.edgeIndex[p.edges[i].id] = p.edges[i];
    // }
    // p.edges = p.vertices.map((v, i) => )
  });

  edges.forEach(edge => {
    let [a,b] = edge.polygons;
    polygons[a].edgeMap[edge.id] = polygons[b];
    polygons[b].edgeMap[edge.id] = polygons[a];
    // polygons[a].edgeIndex[edge.id].adjacentPoly = polygons[b];
    // polygons[b].edgeIndex[edge.id].adjacentPoly = polygons[a];

    polygons[a].edgeIndex[edge.id].shared = polygons[b].edgeIndex[edge.id];
    polygons[b].edgeIndex[edge.id].shared = polygons[a].edgeIndex[edge.id];
  });

  return {
    vertices: vertices.slice(),
    polygons,
    edges
  };
}

export function collectPlanarPolygons(geometry) {
  return geometry.faces.reduce((polygons, face) => {
    let polygon = polygons.find(polygon => polygon.normal.angleTo(face.normal) < 0.01);
    if (!polygon) polygons.push(polygon = {
      index: polygons.length,
      faces: [],
      edges: [],
      vertices: [],
      plane: planeFromFace(face, geometry),
      normal: face.normal,
      edgeMap: {}
    });

    [face.a, face.b, face.c].filter(i => polygon.vertices.indexOf(i) === -1).forEach(i => polygon.vertices.push(i));
    polygon.faces.push(Object.assign({}, face, {vertices: getPointsFromFace(face, geometry)}));
    polygon.edges.push(
      [face.a, face.b],
      [face.b, face.c],
      [face.c, face.a]
    );

    return polygons;
  }, []);
}

export function orderPolygonVertices(polygon, geometry) {
  let vertices = polygon.vertices.map(v => geometry.vertices[v]),
    center = vertices.reduce((a, b) => new Vector3().addVectors(a, b)).divideScalar(5),
    points = vertices.map((v, i) => ({index: polygon.vertices[i], vertex: v, vector: new Vector3().subVectors(v, center)}));

    points.forEach(p => {
      let angle = p.vector.angleTo(points[0].vector),
        cross = new Vector3().crossVectors(points[0].vector, p.vector);
        if (cross.angleTo(polygon.normal) > 0.01) angle = 2*Math.PI - angle;
        p.angle = angle;
    });

    points.sort((a, b) => a.angle - b.angle);
  return points.map(p => p.index);
}

function collectEdgesFromPolygons(polygons) {
  return polygons.reduce((edges, polygon) => {
    polygon.edges.forEach(pair => {
      let key = ID_FROM_PAIR(...pair.slice()),
        edge = edges.find(({id}) => id === key);

      if (!edge) edges.push(edge = { id: key, polygons: [] });
      edge.polygons.push(polygon.index);

      if (edge.polygons.length > 1 && edge.polygons.every(index => index === polygon.index)) {
        edges = edges.filter(e => e.id !== edge.id);
      }
    });

    return edges;
  }, []);
}

function planeFromFace(face, geometry) {
  return new Plane().setFromCoplanarPoints(
    ...getPointsFromFace(face, geometry)
  );
}

function pointInPolygon(point, {faces}) {
  return faces.some(({vertices}) => new Triangle(...vertices).containsPoint(point));
}

// /**
//  * Return an array of faces from a given geometry.
//  *
//  * This handles planar faces made up of multiple triangles.
//  *
//  * @param {THREE.Geometry} geometry
//  * @returns {Array<Object>} objects containing {index, normal, plane, faces}
//  */
// function getFacesFromGeometry(geometry) {
// 	return geometry.faces.reduce((groups, face) => {
// 		let group = groups.find(g => g.normal.angleTo(face.normal) < 0.01);
// 		if (!group) groups.push(group = {
// 			index: groups.length,
// 			normal: face.normal,
// 			_faces: [],
// 			edges: new Set(),
// 			plane: new THREE.Plane().setFromCoplanarPoints(
// 				...getPointsFromFace(face, geometry)
// 			)
// 		});
//
//
// 		group._faces.push(face);
// 		[
// 			[face.a, face.b],
// 			[face.b, face.c],
// 			[face.c, face.a]
// 		].forEach(
// 			edge => group.edges.add(edge.sort().join('-'))
// 		);
// 	});
// }


// export function getGeometryMap(geometry) {
//   // let polygons = geometry.faces.reduce((groups, face) => {
//   //   let group = groups.find(g => g.normal.angleTo(face.normal) < 0.01);
//   //   if (!group) groups.push(group = {
//   //     index: groups.length,
//   //     normal: face.normal,
//   //     edges: new
//   //     faces: []});
//   //
//   //   group.faces.push(face);
//   //   return groups;
//   // });
//
//
//   let polygons = geometry.faces.reduce((groups, face) => {
//     let group = groups.find(g => g.normal.angleTo(face.normal) < 0.01),
//       triangle = new Triangle(...getPointsFromFace(face, geometry));
//
//
//     if (!group) groups.push(group = {
//       index: groups.length,
//       normal: face.normal,
//       edges: new Set(),
//       edgeMap: {},
//       adjacent: [],
//       plane: new Plane().setFromCoplanarPoints(
//         triangle.a, triangle.b, triangle.c
//       )
//     });
//
//     [[face.a, face.b], [face.b, face.c], [face.c, face.a]].forEach((a, b) => {
//       let edge = `${a}-${b}`,
//         dup = `${b}-${a}`;
//
//       if (group.edges.has(dup)) {
//         group.edges.delete(dup);
//         return;
//       }
//
//       group.edges.add(edge);
//       group.edgeMap[a] = b;
//     });
//
//     return groups;
//   }, []);
//
//   polygons.forEach(face => {
//     face.circuit = Array.from(face.edges)
//       .map(pair => pair.split('-').map(n => parseInt(n)))
//       .reduce((map, [a,b]) => (map[a] = b, map), {});
//
//     face.edges = new Set(
//       [...face.edges].map(edge =>
//         edge.split('-')
//           .map(n => parseInt(n))
//           .sort().join('-')
//       )
//     );
//   });
//
//   polygons.forEach(face => {
//     polygons.forEach((other, i) => {
//       if (other === face) return;
//       let edge = [...other.edges].find(edge => face.edges.has(edge));
//
//       if (edge) face.edgeMap[edge] = i;
//     });
//   });
//
//   geometry.polygons = polygons;
//
//   // console.log(polygons);
//   console.log(geometry);
//
//   // console.log(5, polygons[5]);
//   /////polygons.forEach(face => console.log(face.index, face.edgeMap ));
//   // let start = polygons[5];
//   // let opposite = polygons.find(face => face.adjacent.every(index => start.adjacent.indexOf(index) === -1));
//   // console.log(start.index, start);
//   // console.log(opposite.index, opposite);
// }


/**
* Cast a ray against a geometry and find the intersection point
*
* @param {THREE.Ray} ray
* @param {THREE.Geometry} geometry
* @returns {null|Object} intersection ({face, point})
*/
function projectPoint(ray, geometry) {
  let point, tri;
  let face = geometry.faces.find(face => {
    let vertices = getPointsFromFace(face, geometry);
    point = ray.intersectPlane(new Plane().setFromCoplanarPoints(...vertices));
    return point && new Triangle(...vertices).containsPoint(point) && point;
  });

  return face && {face, point};
}

/**
* Find intersection point and polygon (if any) in collection of polygons
*
* @param {THREE.Ray} ray
* @param {THREE.Geometry} geometry
* @returns {null|Object} intersection ({face, point})
*/
export function intersectPolygons(ray, polygons) {
  let point, polygon = polygons.find(polygon => {
    point = ray.intersectPlane(polygon.plane);
    return point && pointInPolygon(point, polygon) && point;
  });

  return polygon && {polygon, point};
}


/**
* Create a ray from the origin to a point described by angles theta and phi.
*
* @param {Float} theta - angle around y axis in radians
* @param {Float} phi - angle around x axis in radians
* @returns {THREE.Ray} ray
*/
export function rayFromAngles(theta, phi) {
  phi += Math.PI/2;
  return new Ray(
    new Vector3(0, 0, 0),
    new Vector3(
      Math.cos(theta) * Math.sin(phi),
      Math.cos(phi),
      Math.sin(theta) * Math.sin(phi)
    ).normalize()
  );
}


/**
 * Produce a tree of polygons starting from a given polygon and following one or more edges
 *
 * @param {Object} polygon - an object with edges pointing to adjacent and shared edges and their containing polygon
 * @param {Array<Object>} directions - an array of one or more edges to follow in the given polygon and further directions to take from there.
 * @returns {Array<Object>} polygons
 */
export function travel(edge, next) {
  return {
    node: {
      edge,
      poly: edge.poly,
    },
    children: [].concat(next).map(e => {
      let target;
      if (typeof e === 'number') target = edge.poly.edges[e];
      else if (e.index !== undefined) target = edge.poly.edges[e.index];
      else if (e.offset) target = ARRAY_CYCLE(edge.poly.edges, edge.index + e.offset);
      else throw new Error('Expected relative edge offset property');

      return travel(target.shared, e.next || []);
    })
  }
}
