import { groupBy } from 'lodash'
import { Box2, CurvePath, Line3, Matrix4, Vector3 } from 'three'
import { getUnfoldedHull, getOrientationMatrix } from './hull'
import { getTabMaker } from './tabs'
import { header as svgHeader, element } from './svg'
import * as directives from './directives'

const tabScale = 1 / 10

const PHI = (1 + Math.sqrt(5)) / 2
const dodecahedronInscribedRadiusRatio = (
  Math.pow(PHI, 2) /
  (2 * Math.sqrt(3 - PHI))
)

export function drawSVG(polygons, stars, asterisms, netOptions) {
  const connected = !netOptions.disconnectPolygons

  polygons.forEach(polygon => {
    polygon.transform = polygon.matrix.clone()//.premultiply(viewboxTransform)
    if (!connected && polygon.fold) {
      polygon.cuts.push(polygon.fold)
      polygon.fold = null
    }
  })

  const transformations = polygons.map(({ transform }) => transform)
  const tabMaker = getTabMaker(transformations, tabScale, polygons[0].polygon)
  const tabs = [].concat(...polygons.map(({polygon}) => polygon.edges))
    .reduce((tabs, edge) => {
      const existing = tabs.find(sibling => sibling.id === edge.id)
      const polygon = polygons[edge.poly.index]
      const sibling = polygons[edge.shared.poly.index]
      const edgeIsFold = polygon.fold && polygon.fold.id === edge.id
      const edgeIsSiblingFold = sibling.fold && sibling.fold.id === edge.id

      if (!existing && !edgeIsFold && !edgeIsSiblingFold) {
        tabs.push(tabMaker(edge))
      }

      return tabs
    }, [])

  const starPaths = getStarPaths(polygons, tabs, stars)
  const asterismQuads = getAsterismQuads(polygons, tabs, asterisms)

  connected
    ? render(polygons, tabs, starPaths, asterismQuads)
    : polygons.forEach(polygon => render([polygon], tabs, starPaths, asterismQuads))
}

const render = (polygons, tabs, starPaths, asterismQuads) => {
  const edgeHull = getUnfoldedHull(polygons)
  const aaRotation = getOrientationMatrix(edgeHull)
  const boundingBox = new Box2().setFromPoints(
    edgeHull.map(p => p.applyMatrix4(aaRotation))
  )

  // TODO: refactor this section into a function that allows for scaling based
  // on desired radius or edge length or maximum unfolded dimensions
  const offset = boundingBox.min.clone().negate()

  // const scale = 100 / boundingBox.getSize().x
  // const scale = 12.584086145276297
  const edgeLength = polygons[0].polygon.edges[0].line.distance()
  const tabHeight = edgeLength * tabScale
  const padding = tabHeight * 1.25

  const paddedBoundingBox = boundingBox.getSize().add(
    new Vector3(padding, padding, 0).multiplyScalar(2)
  )

  const availableWidth = 71 - padding*2
  const availableScale = availableWidth / paddedBoundingBox.x
  // const availableEdgeLength = edgeLength * availableScale
  // const availableHeight = availableScale * paddedBoundingBox.y
  // const availableRadius = availableEdgeLength * dodecahedronInscribedRadiusRatio

  // console.log({
  //   availableWidth,
  //   availableHeight,
  //   availableScale,
  //   availableEdgeLength,
  //   availableRadius
  // })

  const viewBoundingBox = paddedBoundingBox.multiplyScalar(availableScale)
  const viewbox = [0, 0, viewBoundingBox.x, viewBoundingBox.y]

  const viewboxTransform = new Matrix4()
    .multiply(new Matrix4().makeScale(availableScale, availableScale, 1))
    .multiply(new Matrix4().makeTranslation(offset.x + padding, offset.y + padding, 0))
    .multiply(aaRotation)

  polygons.forEach(({ transform }) => transform.premultiply(viewboxTransform))

  const { cuts, folds } = polygons.reduce((results, { polygon, cuts, fold, transform }) => {
    const polygonId = polygon.index
    const mapEdge = edge => edge.line.clone().applyMatrix4(transform).toPoints()

    if (fold) {
      const edge = mapEdge(fold)
      const adjacentPoly = polygons[fold.poly.index]

      if (adjacentPoly) {
        results.folds.push(edge)
      } else {
        results.cuts.push(edge)
      }
    }

    polygon.edges.forEach(edge => {
      if (!polygons[edge.shared.poly.index]) {
        cuts.push(edge)
      }
    })

    cuts.forEach(cut => {
      // render edges with tabs defined as folds instead of cuts
      const container = tabs.find(tab => tab.id === cut.id && tab.polygonId === polygonId)
        ? results.folds
        : results.cuts

      container.push(mapEdge(cut))
    })

    return results
  }, { cuts: [], folds: [] })

  const starPathsByPolygon = groupBy(starPaths, 'polygonId')
  const asterismLinesByPolygon = groupBy(asterismQuads, 'polygonId')
  const tabsByPolygon = groupBy(tabs, 'polygonId')

  polygons.forEach(({ polygon }) => {
    const paths = starPathsByPolygon[polygon.index] || []
    const lines = asterismLinesByPolygon[polygon.index] || []
    const tabs = tabsByPolygon[polygon.index] || []

    paths.forEach(path => path.applyMatrix4(viewboxTransform))
    lines.forEach(line => line.applyMatrix4(viewboxTransform))
    tabs.forEach(tab => tab.quad.forEach(point => point.applyMatrix4(viewboxTransform)))
  })

  const stroke = { 'stroke-width': '0.01pt', fill: 'none' }
  const strokeRed = Object.assign({}, stroke, { stroke: 'red' })
  const strokeBlue = Object.assign({}, stroke, { stroke: 'blue' })

  const container = element('svg', {
    id: 'output',
    preserveAspectRatio: 'xMinYMin',
    viewBox: viewbox.join(' '),
    width: '100%',
    // width: `${viewBoundingBox.x}cm`,
    height: `${viewBoundingBox.y}cm`
  }, [
    element('g', {id: 'calibration', ...strokeRed}, [element('rect', { x: 0, y: 0, width: 2.54, height: 2.54 })]),
    element('g', {id: 'cuts', ...strokeRed}, cuts.map(cut => (
      element('path', { d: directives.line(cut) })
    ))),
    element('g', {id: 'folds', ...strokeBlue}, folds.map(fold => (
      element('path', { d: directives.line(fold) })
    ))),
    element('g', {id: 'stars', ...strokeRed}, polygons.map(({ polygon }) => (
      element('g', {
        id: `polygon-${polygon.index}-stars`
      }, starPathsByPolygon[polygon.index].map(path => (
        element('path', {
          d: directives.path(path)
        })
      ))
    )))),
    element('g', {id: 'constellations', ...strokeRed}, polygons.map(({ polygon }) => (
      element('g', {
        id: `polygon-${polygon.index}-asterisms`
      }, asterismLinesByPolygon[polygon.index].map(line => (
        element('path', { d: directives.line(line.toPoints()) })
      )))
    ))),
    element('g', {id: 'tabs', ...strokeRed}, polygons.map(({ polygon }) => (
      element('g', {
        id: `polygon-${polygon.index}-tabs`
      }, (tabsByPolygon[polygon.index] || []).map(({ quad }) => (
        element('path', { d: directives.poly(quad) })
      )))
    ))),
    element('g', {
      id: 'polygon-labels',
      fill: 'none',
      stroke: 'magenta',
      'stroke-width': '.02pt',
      'font-family': 'Garamond',
      'font-size': '1pt',
      'text-anchor': 'middle'
    }, polygons.map(({ polygon, transform }) => {
      const center = polygon.center.clone().applyMatrix4(transform)
      return element('text', {
        x: center.x,
        y: center.y,
        dy: '.25pt'
      }, [polygon.index])
    }))
  ])

  const actions = document.createElement('div')
  actions.style.position = 'fixed'
  actions.style.top = 0
  actions.style.right = 0
  actions.style.padding = '20px'

  const blobUrl = URL.createObjectURL(new Blob(
    [svgHeader + '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"' + container.outerHTML.slice(4)],
    { type: 'application/octet-stream' }
  ))

  const saveButton = document.createElement('button')
  saveButton.style.width = '90px'
  saveButton.style.margin = '2px'
  saveButton.textContent = 'Save'

  const saveLink = document.createElement('a')
  saveLink.style.display = 'block'
  saveLink.href = blobUrl
  saveLink.download = 'star-projector-net.svg'
  saveLink.appendChild(saveButton)

  const close = document.createElement('button')
  close.style.display = 'block'
  close.style.width = '90px'
  close.style.margin = '2px'
  close.textContent = 'Close'
  close.addEventListener('click', () => {
    document.body.removeChild(actions)
    document.body.removeChild(container)
    URL.revokeObjectURL(blobUrl)
  })

  document.body.appendChild(container)
  document.body.appendChild(actions)
  actions.appendChild(saveLink)
  actions.appendChild(close)
}

const getStarPaths = (polygons, tabs, stars) => (
  stars.reduce((results, { paths }) => {
    paths.forEach(path => {
      const { polygonId } = path
      const { polygon } = polygons[polygonId]
      const transform = polygons[polygonId].transform
      const transformed = path.clone().applyMatrix4(transform)

      results.push(Object.assign(
        transformed, {polygonId}
      ))

      const potentialOverlaps = tabs.filter(tab => (
        tab.polygonId !== polygonId &&
        polygon.edges.some(edge => edge.id === tab.id)
      ))

      potentialOverlaps.forEach(tab => {
        const { polygonId } = tab
        let anyPointIncluded = false
        let anyPointExcluded = false

        for (let curve of transformed.curves) {
          for (let point of curve.getControlPoints()) {
            if (tab.poly.containsPoint(point)) anyPointIncluded = true
            else anyPointExcluded = true
          }
        }

        // If none of the  control points of the curve fell inside the tab there
        // isn't any need to continue processing this path.
        if (!anyPointIncluded) {
          return
        }

        // If none of the control points fall outside of the tab then we can
        // simply copy the path as a whole and shift it into the tab's space.
        if (!anyPointExcluded) {
          results.push(Object.assign(
            transformed.clone().applyMatrix4(tab.toTab),
            { polygonId }
          ))
          return
        }

        const clippedCurve = transformed.curves.reduce((clipped, curve) => {
          const anyPointIncluded = curve.getControlPoints().some(point => tab.poly.containsPoint(point))

          if (!anyPointIncluded) {
            // console.log('nevermind')
            return clipped
          }

          tab.overlapEdges.forEach(edge => {
            const intersections = curve.intersectLine(edge)

            if (intersections.length === 0) {
              // The curve doesn't intersect, but some points lie inside; that
              // means they all do and we can copy it in full.
              clipped.push(curve.clone())
              return
            }

            if (intersections.length === 1) {
              const [a, b] = curve.splitAt(intersections[0].t)
              const aInside = a.getControlPoints().some(p => tab.poly.containsPoint(p, true))

              const kept = aInside ? a : b
              clipped.push(kept.clone())
            }

            if (intersections.length > 1) {
              // TODO: this needs to be accounted for, but so far it hasn't been
              // an issue.
              console.warn('multi-intersect', intersections)
            }
          })

          return clipped
        }, [])

        if (clippedCurve.length) {
          // A curve that doesn't begin where the last ends must be its own path
          const clippedPaths = clippedCurve.reduce((paths, curve) => {
            const currentPath = paths.slice(-1)[0]
            const previous = currentPath.curves.slice(-1)[0]
            const previousEnd = previous && previous.getControlPoints()[3]
            const currentStart = curve.getControlPoints()[0]
            const disjoint = previousEnd !== currentStart

            let target = currentPath

            if (disjoint) {
              target = new CurvePath()
              paths.push(target)
            }

            target.add(curve)
            return paths
          }, [new CurvePath()])

          results.push(
            ...clippedPaths
              .filter(path => path.curves.length > 0)
              .map(path => Object.assign(
                path.clone().applyMatrix4(tab.toTab),
                { polygonId }
              ))
          )
        }
      })
    })

    return results
  }, [])
)

const getAsterismQuads = (polygons, tabs, asterisms) => (
  asterisms.reduce((results, { polygonId, quad }) => {
    const { polygon } = polygons[polygonId]
    const transform = polygons[polygonId].transform
    const mapped = quad.map(p => p.clone().applyMatrix4(transform))
    const mappedLines = [
      Object.assign(new Line3(mapped[0], mapped[1]), { polygonId }),
      Object.assign(new Line3(mapped[2], mapped[3]), { polygonId }),
      Object.assign(new Line3(mapped[4], mapped[5]), { polygonId }),
      Object.assign(new Line3(mapped[6], mapped[7]), { polygonId })
    ]

    const result = mappedLines
    const potentialOverlaps = tabs.filter(tab => (
      tab.polygonId !== polygonId &&
      polygon.edges.some(edge => edge.id === tab.id)
    ))

    potentialOverlaps.forEach(tab => {
      const { polygonId } = tab
      const overlap = mapped.some(point => (
        tab.poly.triangles.some(triangle => triangle.containsPoint(point))
      ))

      // TODO: Account for lines that span an overlapping tab without either end
      // point being contained by the tab
      if (!overlap) {
        return
      }

      mappedLines.forEach(edge => {
        const insidePoints = edge.toPoints().filter(tab.poly.containsPoint)
        if (insidePoints.length === 0) {
          return
        } else if (insidePoints.length === 2) {
          // the whole line is inside the tab, just copy it
          result.push(
            Object.assign(
              edge.clone().applyMatrix4(tab.toTab),
              { polygonId }
            )
          )
          return
        }

        const [insidePoint] = insidePoints
        const intersectionPoints = tab.overlapEdges
          .map(boundary => boundary.intersectLine(edge))
          .filter(point => !!point)

        if (intersectionPoints.length === 0) {
          return
        }

        if (intersectionPoints.length > 1) {
          intersectionPoints.sort((a, b) => (
            insidePoint.distanceToSquared(a) -
            insidePoint.distanceToSquared(b)
          ))
        }

        result.push(
          Object.assign(
            new Line3(insidePoint, intersectionPoints[0])
              .clone().applyMatrix4(tab.toTab),
            { polygonId }
          )
        )
      })
    })

    return [...results, ...result]
  }, [])
)
