  /**
 * Resolve vertex indices of a face from the given geometry
 *
 * @param {THREE.Face} face
 * @param {THREE.Geometry} geometry
 * @returns {Array<THREE.Vector3>}
 */
function getPointsFromFace(face, geometry) {
	return [
		geometry.vertices[face.a],
		geometry.vertices[face.b],
		geometry.vertices[face.c],
	];
}


/**
 */
function getGeometryMetadata(geometry) {
	let {vertices} = geometry;
	let polygons = collectPlanarPolygons(geometry);
	let edges = collectEdgesFromPolygons(polygons);

	edges.forEach(edge => {
		let [a,b] = edge.polygons;
		polygons[a].edgeMap[edge.id] = polygons[b];
		polygons[b].edgeMap[edge.id] = polygons[a];
	});

	return {
		vertices: vertices.slice(),
		polygons,
		edges
	};
}

function collectPlanarPolygons(geometry) {
	return geometry.faces.reduce((polygons, face) => {
		let polygon = polygons.find(polygon => polygon.normal.angleTo(face.normal) < 0.01);
		if (!polygon) polygons.push(polygon = {
			index: polygons.length,
			faces: [],
			edges: [],
			plane: planeFromFace(face, geometry),
			normal: face.normal,
			edgeMap: {}
		});

		polygon.faces.push(Object.assign({}, face, {vertices: getPointsFromFace(face, geometry)}));
		polygon.edges.push(
			[face.a, face.b],
			[face.b, face.c],
			[face.c, face.a]
		);

		return polygons;
	}, []);
}

function collectEdgesFromPolygons(polygons) {
	return polygons.reduce((edges, polygon) => {
		polygon.edges.forEach(pair => {
			let key = pair.slice().sort((a,b) => a-b).join('-'),
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
	return new THREE.Plane().setFromCoplanarPoints(
		...getPointsFromFace(face, geometry)
	);
}

function pointInPolygon(point, {faces}) {
	return faces.some(({vertices}) => new THREE.Triangle(...vertices).containsPoint(point));
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


function getGeometryMap(geometry) {
  // let polygons = geometry.faces.reduce((groups, face) => {
  //   let group = groups.find(g => g.normal.angleTo(face.normal) < 0.01);
  //   if (!group) groups.push(group = {
  //     index: groups.length,
  //     normal: face.normal,
  //     edges: new
  //     faces: []});
  //
  //   group.faces.push(face);
  //   return groups;
  // });


	let polygons = geometry.faces.reduce((groups, face) => {
		let group = groups.find(g => g.normal.angleTo(face.normal) < 0.01),
			triangle = new THREE.Triangle(...getPointsFromFace(face, geometry));


		if (!group) groups.push(group = {
			index: groups.length,
			normal: face.normal,
			edges: new Set(),
      edgeMap: {},
      adjacent: [],
			plane: new THREE.Plane().setFromCoplanarPoints(
				triangle.a, triangle.b, triangle.c
			)
		});

		[[face.a, face.b], [face.b, face.c], [face.c, face.a]].forEach((a, b) => {
      let edge = `${a}-${b}`,
        dup = `${b}-${a}`;

      if (group.edges.has(dup)) {
        group.edges.delete(dup);
        return;
      }

      group.edges.add(edge);
      group.edgeMap[a] = b;
		});

		return groups;
	}, []);

  polygons.forEach(face => {
    face.circuit = Array.from(face.edges)
      .map(pair => pair.split('-').map(n => parseInt(n)))
      .reduce((map, [a,b]) => (map[a] = b, map), {});

    face.edges = new Set(
      [...face.edges].map(edge =>
        edge.split('-')
          .map(n => parseInt(n))
          .sort().join('-')
      )
    );
  });

  polygons.forEach(face => {
    polygons.forEach((other, i) => {
      if (other === face) return;
      let edge = [...other.edges].find(edge => face.edges.has(edge));

      if (edge) face.edgeMap[edge] = i;
    });
  });

	geometry.polygons = polygons;

  // console.log(polygons);
  console.log(geometry);

  // console.log(5, polygons[5]);
  /////polygons.forEach(face => console.log(face.index, face.edgeMap ));
  // let start = polygons[5];
  // let opposite = polygons.find(face => face.adjacent.every(index => start.adjacent.indexOf(index) === -1));
  // console.log(start.index, start);
  // console.log(opposite.index, opposite);
}


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
		point = ray.intersectPlane(new THREE.Plane().setFromCoplanarPoints(...vertices));
		return point && new THREE.Triangle(...vertices).containsPoint(point) && point;
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
function intersectPolygons(ray, polygons) {
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
function rayFromAngles(theta, phi) {
	phi += Math.PI/2;
	return new THREE.Ray(
		new THREE.Vector3(0, 0, 0),
		new THREE.Vector3(
			Math.cos(theta) * Math.sin(phi),
			Math.cos(phi),
			Math.sin(theta) * Math.sin(phi)
		).normalize()
	);
}
