import * as three from 'three';

import {init} from './scene';
import {createMenu} from './menu';
import {drawSVG} from './svg';

import {getTopology, projectVector, projectLineSegment} from './geometry/topology';
import {constructHierarchicalMesh} from './geometry/hierarchical-mesh';

import starCatalog from './catalogs/hd_filtered.json';
import asterismsCatalog from './catalogs/asterisms.json';


function o(constructor, props, children=[]) {
  let node = Object.assign(new constructor, props);

  children = [].concat(children);
  if (children.length) {
    node.add(...children);
  }

  return node;
}

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
let objectByPolygon = {};

/// before getting started, fill in some containers for each polygon in the
/// hierarchical mesh.
hierarchicalMesh.traverse(obj => {
  let node = obj.userData.node;
  if (!node) return;

  // now for anything related to a polygon we can lookup the matrix transform
  objectByPolygon[node.poly.index] = obj;
});

/// project stars onto topology
let projectedStars = stars.map(star => {
  let {sra0, sdec0} = star;
  let {polygon, point} = projectVector(vectorFromAngles(sra0, sdec0), topology);

  return {star, polygon, point};
});

/// project asterism lines onto topology
let projectedAsterisms = [].concat(...asterisms.map(asterism => {
  let pairs = asterism.stars.map(id => projectedStars.find(s => s.star.xno === id)).reduce(PAIR, [[]]);
  return [].concat(
    ...pairs.map(pair =>
      projectLineSegment(
        topology,
        ...pair.map(({point}) => point)
      )
    )
  ).map(
    segment => Object.assign({asterism}, segment)
  );
}));


/// Project edge and cut lines
let projectedEdges = topology.polygons.map(polygon => {
  let obj = objectByPolygon[polygon.index],
    node = obj.userData.node,
    parent = obj.userData.parent,
    children = obj.userData.children;

  let fold = parent && node.edge.id.split('-').map(n => topology.vertices[Number(n)].clone());
  let cuts = node.poly.edges
    .filter(e => (
      (!parent || e.shared.poly !== parent.poly)
      && children.every(c => c.node.edge.id !== e.id)
    ))
    .map(e =>
      e.id.split('-')
        .map(n => topology.vertices[Number(n)].clone())
    );

  return {polygon, fold, cuts};
});


hierarchicalMesh.traverse(obj => {
  let polygon = obj.userData.node && obj.userData.node.poly;
  if (!polygon) return;

  let stars = projectedStars.filter(s => s.polygon === polygon),
    {fold, cuts} = projectedEdges.find(e => e.polygon === polygon),
    asterisms = projectedAsterisms
      .filter(a => a.polygon === polygon.index)
      .reduce((map, {asterism, edge}) => {
        if (!map[asterism.name]) map[asterism.name] = [];
        map[asterism.name].push(edge);
        return map;
      }, {});

  obj.add(
    o(three.Points, {name: 'stars', geometry: o(three.Geometry, {vertices: stars.map(s => s.point)})}),
    o(three.Mesh, {geometry: o(three.Geometry, {vertices: topology.vertices.slice(), faces: polygon.faces.slice()})}),
    o(
      three.Object3D,
      {name: 'asterisms'},
      Object.keys(asterisms).map(name =>
        o(
          three.LineSegments,
          {
            name: `asterism-${name}`,
            userData: {asterism: {name}, type: 'asterism'},
            geometry: o(three.Geometry, {vertices: [].concat(...asterisms[name])})
          }
        )
      )
    ),
    fold && o(
      three.LineSegments,
      {
        userData: {type: 'fold'},
        geometry: o(three.Geometry, {vertices: fold})
      }
    ),
    o(
      three.LineSegments,
      {
        userData: {type: 'cuts'},
        geometry: o(three.Geometry, {vertices: [].concat(...cuts)})
      }
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

let {render} = init(hierarchicalMesh);
drawSVG(objectByPolygon, projectedStars, projectedAsterisms, projectedEdges);
createMenu(
  asterisms,
  hoverAsterism => {
    hierarchicalMesh.traverse(node => {
      if (!node.userData.asterism) return;
      node.material = node.userData.asterism.name === hoverAsterism
        ? materials.asterismLinesHover
        : materials.asterismLines
    });

    render();
  },
  toggleAsterism => {
    hierarchicalMesh.traverse(node => {
      if (!node.userData.asterism || node.userData.asterism.name !== toggleAsterism) return;
      node.visible = !node.visible;
      document.querySelector(`svg g[id="${toggleAsterism}-lines"]`).setAttribute(
        'stroke', node.visible ? '#660000' : 'transparent'
      );
    });


    render();
  }
);


render();
