import * as three from 'three';

import {init} from './scene';
import {createMenu} from './menu';
import {drawSVG} from './svg';

import {getTopology, projectVector, projectLineSegment} from './geometry/topology';
import {constructHierarchicalMesh} from './geometry/hierarchical-mesh';
import * as catalogs from './catalogs';


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

let materials = {
  asterismLines: new three.LineDashedMaterial({color: 0xcccccc, dashSize: 0.3, gapSize: 0.1}),
  asterismLinesHover: new three.LineBasicMaterial({color: 0xffff00, linewidth: 3}),
  cutLines: new three.LineBasicMaterial({color: 0xaaaaaa, linewidth: 2}),
  foldLines: new three.LineDashedMaterial({color: 0x9999aa, linewidth: 2, dashSize: 1, gapSize: 0.3}),
  stars: new three.PointsMaterial({color: 0xffffff, size:0.125}),
  faces: new three.MeshBasicMaterial({color: new three.Color('hsl(230, 54%, 25%)'), transparent: true, opacity: 0.6, side: three.DoubleSide})
};


function main(polyhedron, stars, asterisms) {
  /// select mesh geometry;
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
  let top = hierarchicalMesh.children[0].userData.node.poly,
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

  let {render} = init(o(three.Object3D, {}, hierarchicalMesh));
  drawSVG(objectByPolygon, projectedStars, projectedAsterisms, projectedEdges);
  createMenu(
    asterisms,
    hoverAsterism => {
      hierarchicalMesh.traverse(node => {
        if (!node.userData.asterism) return;
        node.material = node.userData.asterism.name === hoverAsterism
          ? materials.asterismLinesHover
          : materials.asterismLines;

        [].slice.call(document.querySelectorAll(`svg g#asterisms-groups > g:not([stroke="transparent"])`))
            .forEach(element => {
              element.style.stroke = null;
              element.style.strokeWidth = null;
            });

        let group = document.querySelector(`svg g[id="${hoverAsterism}-lines"]`);
        group.style.stroke = '#ff7700';
        group.style.strokeWidth = .25;
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
}


catalogs.loadAsterismCatalog({
  starCounts: {$elemMatch: {count: {$gt: 3}}}
}).then(asterisms => {
  let connectedStars = [...new Set([].concat(...asterisms.map(a => a.stars)))];
  return catalogs.loadStarCatalog({
    $or: [
      {magnitude: {$lte: 4.75}},
      {id: {$in: connectedStars}}
    ]
  }).then(stars => {
    console.log(`loaded ${stars.length} stars`)
    setTimeout(() => main(new three.DodecahedronGeometry(10), stars, asterisms), 0);
  });
})
.catch(err => {
  console.error(err);
  throw err;
});
