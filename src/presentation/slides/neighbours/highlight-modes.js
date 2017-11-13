import * as materials from './materials'

const unhighlight = (scene) => {
  scene.traverse(node => {
    if (!node.userData.isElement) {
      return
    }

    node.material = materials.regular
  })
}

const search = (scene, match) => {
  let results = []

  scene.traverse(node => {
    if (match(node)) {
      results.push(node)
    }
  })

  return results
}

const edgeContainsVertex = (edge, vertex) => {
  return (
    edge.line.start === vertex ||
    edge.line.end === vertex
  )
}

export const vertexEdges = (vertex, topology, scene) => {
  unhighlight(scene)

  if (!('vertexId' in vertex.userData)) {
    return
  }

  const topologyVertex = topology.vertices[vertex.userData.vertexId]
  const topologyEdges = topology.edges.filter(edge => edgeContainsVertex(edge, topologyVertex))
  const neighbours = topologyEdges.map(edge => {
    const [object] = search(scene, node => node.userData.edgeId === edge.id)
    return object
  })

  vertex.material = materials.active
  neighbours.forEach(node => { node.material = materials.neighbour })
}

export const edgeEdges = (edge, topology, scene) => {
  unhighlight(scene)

  if (!('edgeId' in edge.userData)) {
    return
  }

  const topologyEdge = topology.edges.find(({id}) => id === edge.userData.edgeId)
  const neighbours = topology.edges.filter(edge => (
    edgeContainsVertex(edge, topologyEdge.line.start) ||
    edgeContainsVertex(edge, topologyEdge.line.end)
  )).map(edge => {
    const [obj] = search(scene, node => node.userData.edgeId === edge.id)
    return obj
  })

  neighbours.forEach(node => { node.material = materials.neighbour })
  edge.material = materials.active
}

export const edgeFaces = (face, topology, scene) => {
  unhighlight(scene)

  if (!face.userData.polygon) {
    return
  }

  const neighbours = face.userData.polygon.edges.map(edge => {
    const [neighbour] = search(scene, node => node.userData.polygonId === edge.shared.poly.index)
    return neighbour
  })

  face.material = materials.active
  neighbours.forEach(node => { node.material = materials.neighbour })
}
