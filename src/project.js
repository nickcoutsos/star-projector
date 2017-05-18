import * as three from 'three';
import Topology from './topology'
import {constructHierarchicalMesh} from './geometry/hierarchical-mesh';
import {fivePointStar} from './shapes/star'
import './extensions/curve-path'

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
  let topology = new Topology(polyhedron)

  const asterismStars = asterisms.reduce((stars, asterism) => {
    asterism.stars.forEach(id => {
      stars.indexOf(id) === -1 && stars.push(id)
    })
    return stars
  }, [])

  return Promise.all(stars.map(star => {
    let {rightAscension, declination} = star;
    const direction = vectorFromAngles(rightAscension, declination)
    return topology.projectVector(direction).then(({polygonId, point}) => {
      if (star.magnitude < 2 || asterismStars.indexOf(star.id) > -1) {
        return topology.projectCurvePath(fivePointStar, direction)
          .then(paths => ({ paths, point, star }))
      }

      return { star, point, polygonId }
    })
  })).then(projectedStars => {
    /// project asterism lines onto topology
    return Promise.all(asterisms.map(asterism => {
      const pairs = asterism.stars
        .map(id => projectedStars.find(s => s.star.id === id).point)
        .reduce(PAIR, [[]])

      return Promise.all(pairs.map(pair => topology.projectLineSegment(...pair)))
        .then(segments => [].concat(...segments))
        .then(segments => segments.map(segment => Object.assign(
          {asterism}, segment
        )))
    }))
    .then(segments => [].concat(...segments))
    .then(projectedAsterisms => build(
      topology,
      projectedStars,
      projectedAsterisms
    ))
  })
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
        .reduce((map, {asterism, edge}) => {
          if (!map[asterism.name]) map[asterism.name] = [];
          map[asterism.name].push(edge);
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

  hierarchicalMesh.traverse(node => {
    if (node instanceof three.LineSegments) {
      node.geometry.computeLineDistances();
      node.userData.className = {
        asterism: 'dash-line asterism',
        fold: 'dash-line fold',
        cuts: 'cut'
      }[node.userData.type] || new three.LineBasicMaterial();
    }
    else if (node instanceof three.Points) {
      node.userData.className = 'stars';
    }
    else if (node instanceof three.Mesh) {
      node.userData.className = 'poly-face';
    }
  });

  return hierarchicalMesh
}

const starPointsObject = points => o(
  three.Points, {
    name: 'stars',
    geometry: o(
      three.Geometry,
      { vertices: points.map(s => s.point) }
    )
  }
)

const starLinesObject = paths => o(
  three.LineSegments, {
    material: new three.LineBasicMaterial({color: 0xffffff}),
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
      userData: {asterism: {name}, type: 'asterism'},
      geometry: o(three.Geometry, {
        vertices: [].concat(...asterisms[name])
      })
    })
  )
)

const polyFoldLinesObject = fold => o(
  three.LineSegments, {
    userData: {type: 'fold'},
    geometry: o(three.Geometry, {vertices: fold})
  }
)

const polyCutLinesObject = cuts => o(
  three.LineSegments, {
    userData: {type: 'cuts'},
    geometry: o(three.Geometry, {
      vertices: [].concat(...cuts)
    })
  }
)
