import {Line3} from 'three'
import '../extensions'

export default function edgesFromPolygons(polygons) {
  const polygonEdges = polygons.map(getPolygonEdges)
  const edgeIndex = indexEdges(polygonEdges)

  polygonEdges.forEach(linkEdges)
  polygonEdges.forEach(edges => {
    edges
      .filter(edge => edge.shared === undefined)
      .forEach(edge => {
        edge.shared = edgeIndex[edge.id].find(e => e != edge)
        edge.shared.shared = edge
      })
  })

  return polygonEdges
}

function getPolygonEdges(polygon) {
  const getNext = cycle(polygon.points)
  return polygon.points.map((vertex, i) => {
    const next = getNext(i)
    return {
      index: i,
      id: pairId(vertex.index, next.index),
      point: vertex.clone(),
      line: new Line3(vertex, next),
      vector: next.clone().sub(vertex).normalize(),
      poly: polygon
    };
  });
}

function linkEdges(edges) {
  const next = cycle(edges, 1)
  const prev = cycle(edges, -1)

  edges.map(edge => Object.assign(edge, {
    next: next(edge.index),
    prev: prev(edge.index)
  }))
}

function indexEdges(polygonEdges) {
  return polygonEdges.reduce((index, edges) => {
    edges.forEach(edge => {
      if (!index[edge.id]) {
        index[edge.id] = []
      }

      index[edge.id].push(edge)
    })

    return index
  }, {})
}

const pairId = (...verts) => verts.sort((a, b) => a - b).join('-')
const cycle = (array, step=1) => index => {
  const next = (index + step) % array.length
  return array[next < 0 ? array.length + next : next]
}
