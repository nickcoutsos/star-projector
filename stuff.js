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

  // console.log(polygons);
  console.log(geometry);

  // console.log(5, polygons[5]);
  /////polygons.forEach(face => console.log(face.index, face.edgeMap ));
  // let start = polygons[5];
  // let opposite = polygons.find(face => face.adjacent.every(index => start.adjacent.indexOf(index) === -1));
  // console.log(start.index, start);
  // console.log(opposite.index, opposite);
}


// /**
//  * Cast a ray against a geometry and find the intersection point
//  *
//  * @param {THREE.Ray} ray
//  * @param {THREE.Geometry} geometry
//  * @returns {THREE.Vecetor3} point
//  */
// function projectPoint(ray, geometry) {
// 	let point, tri;
// 	return geomtery.faces.find(face => {
// 		let vertices = getPointsFromFace(face, geometry);
// 		point = ray.intersectPlane(new THREE.Plane().setFromCoplanarPoints(...vertices));
// 		return point && new THREE.Triangle(...vertices).containsPoint(point) && point;
// 	}) && point;
// }
