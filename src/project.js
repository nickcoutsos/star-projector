import * as three from 'three';
import Topology from './topology'
import {getProjectedStars} from './catalogs'
import {constructHierarchicalMesh} from './geometry/hierarchical-mesh';
import './extensions/curve-path'
import { drawSVG } from './svg'

function o(constructor, props, children=[]) {
  let node = Object.assign(new constructor, props);

  children = [].concat(children);
  if (children.length) {
    node.add(...children);
  }

  return node;
}

export default function project(polyhedron, starQuery, asterismQuery) {
  const topology = new Topology(polyhedron)
  return getProjectedStars(
    topology,
    starQuery,
    asterismQuery
  ).then(({stars, asterisms}) => (
    build(
      topology,
      stars,
      asterisms
    )
  ))
}

const build = (topology, projectedStars, projectedAsterisms) => {
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

  /// Project edge and cut lines
  let projectedEdges = topology.polygons.map(polygon => {
    const polygonId = polygon.index
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

    return {polygonId, fold, cuts};
  });

  hierarchicalMesh.traverse(obj => {
    const polygon = obj.userData.node && obj.userData.node.poly;
    const polygonId = polygon && polygon.index
    if (!polygon) return;

    let points = projectedStars.filter(s => s.polygonId === polygonId),
      {fold, cuts} = projectedEdges.find(e => e.polygonId === polygonId),
      asterisms = projectedAsterisms
        .filter(a => a.polygonId === polygonId)
        .reduce((map, {asterism, quad}) => {
          if (!map[asterism.name]) map[asterism.name] = [];
          map[asterism.name].push(quad);
          return map;
        }, {});

    const starPaths = projectedStars.reduce((paths, star) => {
      if (!star.paths) return paths
      paths.push(...star.paths.filter(path => path.polygonId === polygonId))

      return paths
    }, [])

    obj.add(
      polyFaceObject(polygon),
      fold && polyFoldLinesObject(fold) || o(three.Object3D),
      polyCutLinesObject(cuts),
      starPointsObject(points),
      starLinesObject(starPaths),
      asterismLinesObject(asterisms)
    );
  });

  // Pick the "top" polygon and rotate so that it faces -Z
  let back = new three.Vector3(0, 0, 1)
  let top = hierarchicalMesh.children[0].userData.node.poly,
    angle = top.plane.normal.angleTo(back),
    cross = new three.Vector3().crossVectors(top.plane.normal, back).normalize(),
    rotation = new three.Matrix4().makeRotationAxis(cross, angle)

  // Update the object's matrix with this new transform
  hierarchicalMesh.updateMatrixWorld()

  // Collect each polygon's matrix and fold/cut edges
  const polygons = topology.polygons.map(polygon => {
    const object = objectByPolygon[polygon.index]
    object.updateMatrixWorld()
    const matrix = rotation.clone().multiply(object.matrixWorld.clone())
    const { node, parent, children } = object.userData

    const fold = parent && node.edge
    const cuts = node.poly.edges
      .filter(e => (
        (!parent || e.shared.poly !== parent.poly)
        && children.every(c => c.node.edge.id !== e.id)
      ))

    return {
      polygon,
      normal: polygon.plane.normal.clone().applyMatrix4(rotation),
      matrix,
      fold,
      cuts
    }
  })

  // Render flattened SVG
  drawSVG(polygons, projectedStars, projectedAsterisms)

  return hierarchicalMesh
}

const starPointsObject = points => o(
  three.Points, {
    name: 'stars',
    userData: {className: 'stars'},
    geometry: o(
      three.Geometry,
      { vertices: points.map(s => s.point) }
    )
  }
)

const starLinesObject = paths => o(
  three.LineSegments, {
    userData: {type: 'star', className: 'star shape'},
    geometry: o(
      three.Geometry, {
        vertices: [].concat(
          ...paths.map(path => path.getLineSegments(10))
        )
      }
    )
  }
)

const polyFaceObject = polygon => o(
  three.Mesh, {
    userData: {className: 'poly-face'},
    geometry: o(three.Geometry, {
      vertices: polygon.points.slice(),
      faces: polygon.triangles.map(({a, b, c}) => (
        new three.Face3(
          ...[a,b,c]
            .map(v => polygon.points.indexOf(v))
        )
      ))
    })
  }
)

const asterismLinesObject = asterisms => o(
  three.Object3D,
  {name: 'asterisms'},
  Object.keys(asterisms).map(name =>
    o(three.LineSegments, {
      name: `asterism-${name}`,
      userData: {
        asterism: {name},
        className: 'asterism'
      },
      geometry: o(three.Geometry, {
        vertices: [].concat(...asterisms[name])
      })
    })
  )
)

const polyFoldLinesObject = fold => o(
  three.LineSegments, {
    userData: {className: 'fold'},
    geometry: o(three.Geometry, {vertices: fold})
  }
)

const polyCutLinesObject = cuts => o(
  three.LineSegments, {
    userData: {className: 'cut'},
    geometry: o(three.Geometry, {
      vertices: [].concat(...cuts)
    })
  }
)
