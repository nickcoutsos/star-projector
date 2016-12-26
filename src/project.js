import * as three from 'three';
import {getTopology, projectVector, projectLineSegment} from './geometry/topology';
import {constructHierarchicalMesh} from './geometry/hierarchical-mesh';

let materials = {
  asterismLines: new three.LineDashedMaterial({color: 0xcccccc, dashSize: 0.08, gapSize: 0.01}),
  asterismLinesHover: new three.LineBasicMaterial({color: 0xffff00, linewidth: 3}),
  cutLines: new three.LineBasicMaterial({color: 0xaaaaaa, linewidth: 2}),
  foldLines: new three.LineDashedMaterial({color: 0x9999aa, linewidth: 2, dashSize: 0.08, gapSize: 0.01}),
  stars: new three.PointsMaterial({color: 0xffffff, size:0.0125}),
  faces: new three.MeshBasicMaterial({color: new three.Color('hsl(230, 54%, 25%)'), transparent: true, opacity: 0.6, side: three.DoubleSide})
};

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
		Math.cos(phi) * Math.sin(theta),
		Math.sin(phi),
		Math.cos(phi) * Math.cos(theta)
	).normalize();
}

let PAIR = (pairs, val) => {
	let pair = pairs[pairs.length-1];
	if (pair.length > 1) pairs.push(pair = []);
	pair.push(val);
	return pairs;
};

export default function project(polyhedron, stars, asterisms) {
  let topology = getTopology(polyhedron);
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
    let {rightAscension, declination} = star;
    let {polygon, point} = projectVector(
      vectorFromAngles(rightAscension, declination),
      topology
    );

    return {star, polygon, point};
  });

  /// project asterism lines onto topology
  let projectedAsterisms = [].concat(...asterisms.map(asterism => {
    let pairs = asterism.stars.map(id => projectedStars.find(s => s.star.id === id)).reduce(PAIR, [[]]);
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

    let fold = parent && [node.edge.line.start, node.edge.line.end];
    let cuts = node.poly.edges
      .filter(e => (
        (!parent || e.shared.poly !== parent.poly)
        && children.every(c => c.node.edge.id !== e.id)
      ))
      .map(({line}) => ([line.start, line.end]));

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
      o(three.Mesh, {geometry: o(three.Geometry, {vertices: polygon.vertices.slice(), faces: polygon.triangles.map(({a, b, c}) => new three.Face3(...[a,b,c].map(v => polygon.vertices.indexOf(v))))})}),
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
      ) || o(three.Object3D),
      o(
        three.LineSegments,
        {
          userData: {type: 'cuts'},
          geometry: o(three.Geometry, {vertices: [].concat(...cuts)})
        }
      )
    );
  });

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

  return hierarchicalMesh;
}
