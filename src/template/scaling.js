const PHI = (1 + Math.sqrt(5)) / 2

const inscribedRadiusByFaceCount = {
  4: 1 / Math.sqrt(24),
  6: .5,
  8: Math.sqrt(6) / 6,
  12: Math.pow(PHI, 2) / (2 * Math.sqrt(3 - PHI)),
  20: Math.pow(PHI, 2) / (2 * Math.sqrt(3))
}


const circumscribedRadiusByFaceCount = {
  4: Math.sqrt(3 / 8),
  6: Math.sqrt(3) / 2,
  8: Math.sqrt(2) / 2,
  12: PHI * Math.sqrt(3) / 2,
  20: Math.sin(Math.PI * 2 / 5)
}

export const edgeLength = (polygons, boundingBox, amount) => {
  return amount / polygons[0].polygon.edges[0].line.distance()
}

export const inscribedRadius = (polygons, boundingBox, amount) => {
  const desiredEdgeLength = amount / inscribedRadiusByFaceCount[polygons.length]
  const currentEdgeLength = polygons[0].polygon.edges[0].line.distance()

  return desiredEdgeLength / currentEdgeLength
}

export const cicrcumscribedRadius = (polygons, boundingBox, amount) => {
  const desiredEdgeLength = amount / circumscribedRadiusByFaceCount[polygons.length]
  const currentEdgeLength = polygons[0].polygon.edges[0].line.distance()

  return desiredEdgeLength / currentEdgeLength
}

export const templateHeight = (polygons, boundingBox, amount) => {
  const height = boundingBox.getSize().y
  return amount / height
}

export const templateWidth = (polygons, boundingBox, amount) => {
  const width = boundingBox.getSize().x
  return amount / width
}
