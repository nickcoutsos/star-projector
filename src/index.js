import * as three from 'three';

import {init, render} from './scene';
import {getTopology, projectVector, projectLineSegment} from './geometry/topology';
import {constructHierarchicalMesh} from './geometry/hierarchical-mesh';

import starCatalog from './catalogs/hd_filtered.json';
import asterismsCatalog from './catalogs/asterisms.json';


function vectorFromAngles(theta, phi) {
	return new three.Vector3(
		Math.sin(phi) * Math.sin(theta),
		Math.cos(phi),
		Math.sin(phi) * Math.cos(theta)
	).normalize();
}

let PAIR = (pairs, val) => {
	let pair = pairs[pairs.length-1];
	if (pair.length > 1) pairs.push(pair = []);
	pair.push(val);
	return pairs;
};

let materials = {
  asterismLines: new three.LineBasicMaterial({color: 0x660000}),
  asterismLinesHover: new three.LineBasicMaterial({color: 0xffff00}),
  cutLines: new three.LineBasicMaterial({color: 0xff0000, linewidth: 2}),
  foldLines: new three.LineDashedMaterial({color: 0x660000, linewidth: 2, dashSize: 1, gapSize: 0.3}),
  stars: new three.PointsMaterial({color: 0xffffff, size:0.125}),
  faces: new three.MeshBasicMaterial({color: 0x440000, transparent: true, opacity: 0.6, side: three.DoubleSide})
};


/// filter stars and asterisms because there's plenty of stuff we don't care for

// Count the number of lines connecting each star of each asterism. This is an
// imperfect but useful way to determine which asterisms are visually boring.
// Filter: asterisms with 4 or fewer stars
// Filter: asterisms where no stars are connected to more than 3 other stars.
let asterisms = asterismsCatalog
  .map(asterism => Object.assign(asterism, {starCounts: [].concat(...asterism.stars).reduce((index, id) => (index[id] = (index[id] || 0) + 1, index), {})}))
  .filter(a => a.stars.length > 4)
  .filter(a => Math.max(
    ...Object.keys(a.starCounts)
      .map(id => a.starCounts[id])
    ) > 3);

// Of the remaining asterisms get a set represending the related stars by their
// henry draper catalog id number.
let connectedStars = new Set([].concat(...asterisms.map(a => a.stars)));

// Filter stars to those with magnitude <= 7 OR which are present in an asterism
let stars = starCatalog
  .filter(star => star.mag <= 7 || connectedStars.has(star.hd))
  .map(s => ({xno: s.hd, sdec0: s.decrad - Math.PI/2, sra0: s.rarad, mag: s.mag}));


/// select mesh geometry;
let topology = getTopology(new three.DodecahedronGeometry(10));
let hierarchicalMesh = constructHierarchicalMesh(topology);

/// before getting started, fill in some containers for each polygon in the
/// hierarchical mesh.
hierarchicalMesh.traverse(obj => {
  let node = obj.userData.node;
  if (!node) return;

  obj.add(
    Object.assign(new three.Points(new three.Geometry()), {name: 'stars'}),
    Object.assign(new three.Object3D(), {name: 'asterisms'}),
    new three.Mesh(
      Object.assign(
        new three.Geometry(),
        {vertices: topology.vertices.slice(), faces: node.poly.faces.slice()}
      )
    )
  );
});

/// project stars onto topology
stars
  .forEach(({sra0, sdec0}) => {
    let {polygon, point} = projectVector(vectorFromAngles(sra0, sdec0), topology);
    let mesh = hierarchicalMesh
      .getObjectByName(`polygon-${polygon.index}`)
      .getObjectByName('stars');

    mesh.geometry.vertices.push(point);
  });

/// project asterism lines onto topology
asterisms.forEach(asterism => {
  let pairs = asterism.stars.map(id => stars.find(s => s.xno === id)).reduce(PAIR, [[]]);
  let segments = pairs.map(pair =>
    projectLineSegment(
      topology,
      ...pair.map(
        ({sra0, sdec0}) => projectVector(vectorFromAngles(sra0, sdec0), topology).point
      )
    )
  );

  let edgesByPolygon = [].concat(...segments)
    .reduce((map, {polygon, edge}) => {
      if (!map[polygon]) map[polygon] = [];
      map[polygon].push(edge);
      return map;
    }, {});

  Object.keys(edgesByPolygon).forEach(polygon => {
    let vertices = [].concat(...edgesByPolygon[polygon]);
    let asterisms = hierarchicalMesh
      .getObjectByName(`polygon-${polygon}`)
      .getObjectByName('asterisms');

    asterisms.add(
      Object.assign(
        new three.LineSegments(Object.assign(new three.Geometry(), {vertices})),
        {name: `asterism-${asterism.name}`, userData: {type: 'asterism', asterism}}
      )
    );
  });
});

/// Project edge and cut lines
hierarchicalMesh.traverse(obj => {
  if (!obj.userData.node) return;
  let node = obj.userData.node,
    parent = obj.userData.parent,
    children = obj.userData.children;

  const edgePoints = e => e.id.split('-').map(n => topology.vertices[Number(n)].clone());
  let cutEdges = node.poly.edges
      .filter(e => (!parent || e.shared.poly !== parent.poly) && children.every(c => c.node.edge.id !== e.id))
      .map(edgePoints);

  obj.add(
    parent && Object.assign(
      new three.LineSegments(
        Object.assign(new three.Geometry(), {vertices: edgePoints(node.edge)})
      ),
      {userData: {type: 'fold'}}
    ),
    Object.assign(
      new three.LineSegments(
        Object.assign(new three.Geometry(), {vertices: [].concat(...cutEdges)})
      ),
      {userData: {type: 'cuts'}}
    )
  );
});



let back = new three.Vector3(0, 0, -1);
let top = topology.polygons[0],
  angle = top.normal.angleTo(back),
  cross = new three.Vector3().crossVectors(top.normal, back).normalize(),
  rotation = new three.Matrix4().makeRotationAxis(cross, angle);

hierarchicalMesh.applyMatrix(rotation);
hierarchicalMesh.updateMatrixWorld();
hierarchicalMesh.position.add(top.edges[0].point.clone().applyMatrix4(hierarchicalMesh.matrixWorld));
hierarchicalMesh.userData.animate = t => {
  let alpha = 0.5 * (Math.sin(-Math.PI / 2 + t / 1000) + 1);
  hierarchicalMesh.position.z = (1 - alpha) * -topology.faceRadius;
}

hierarchicalMesh.traverse(node => {
  if (node instanceof three.LineSegments) {
    node.geometry.computeLineDistances();
    node.material = {
      asterism: materials.asterismLines,
      fold: materials.foldLines,
      cuts: materials.cutLines
    }[node.userData.type] || new three.LineBasicMaterial();
  }
  else if (node instanceof three.Points) {
    node.material = materials.stars;
  }
  else if (node instanceof three.Mesh) {
    node.material = materials.faces;
  }
});

init(hierarchicalMesh);
render();
