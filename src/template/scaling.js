const dodecahedronInscribedRadiusRatio = (
  Math.pow(PHI, 2) /
  (2 * Math.sqrt(3 - PHI))
)

const availableWidth = 71 - padding*2
const availableScale = availableWidth / paddedBoundingBox.x
const availableHeight = availableScale * paddedBoundingBox.y
const availableEdgeLength = edgeLength * availableScale
const availableRadius = availableEdgeLength * dodecahedronInscribedRadiusRatio

const viewBoundingBox = paddedBoundingBox.multiplyScalar(availableScale)

console.log({
  availableWidth,
  availableHeight,
  availableScale,
  availableEdgeLength,
  availableRadius
})

export const byWidth = (boundingBox, availableWidth, padding) => {

}
