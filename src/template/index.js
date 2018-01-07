import { groupBy } from 'lodash'
import { Box2, CurvePath, Line3, Matrix4, Vector3 } from 'three'
import { getUnfoldedHull, getOrientationMatrix } from './hull'
import { getTabMaker } from './tabs'
import { header as svgHeader, element } from './svg'
import * as scaling from './scaling'
import * as directives from './directives'

const tabScale = 1 / 10


export function drawSVG(polygons, stars, asterisms, netOptions) {
  const connected = !netOptions.disconnectPolygons

  polygons.forEach(polygon => {
    polygon.transform = polygon.matrix.clone()
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
    ? render(polygons, polygons, tabs, starPaths, asterismQuads, netOptions)
    : polygons.forEach(polygon => render(polygons, [polygon], tabs, starPaths, asterismQuads, netOptions))
}

const render = (polygons, selectedPolygons, tabs, starPaths, asterismQuads, netOptions) => {
  const edgeHull = getUnfoldedHull(selectedPolygons)
  const aaRotation = getOrientationMatrix(edgeHull)
  const boundingBox = new Box2().setFromPoints(
    edgeHull.map(p => p.clone().applyMatrix4(aaRotation))
  )

  const offset = boundingBox.min.clone().negate()
  const edgeLength = polygons[0].polygon.edges[0].line.distance()
  const tabHeight = edgeLength * tabScale

  // TODO: generate thsi from netOptions.padding?
  const padding = tabHeight * 1.25
  const paddedBoundingBox = boundingBox.getSize().add(
    new Vector3(padding, padding, 0).multiplyScalar(2)
  )

  const scale = scaling[netOptions.scaleDimension](polygons, paddedBoundingBox, netOptions.size)
  const viewBoundingBox = paddedBoundingBox.multiplyScalar(scale)
  const viewbox = [0, 0, viewBoundingBox.x, viewBoundingBox.y]

  const scaleTransform = new Matrix4().makeScale(scale, scale, 1)
  const translateTransform = new Matrix4().makeTranslation(offset.x + padding, offset.y + padding, 0)

  const viewboxTransform = new Matrix4()
    .multiply(scaleTransform)
    .multiply(translateTransform)
    .multiply(aaRotation)

  selectedPolygons.forEach(({ transform }) => transform.premultiply(viewboxTransform))

  const { cuts, folds } = selectedPolygons.reduce((results, { polygon, cuts, fold, transform }) => {
    const polygonId = polygon.index
    const mapEdge = edge => edge.line.clone().applyMatrix4(transform).toPoints()

    if (fold) {
      const edge = mapEdge(fold)
      const adjacentPoly = selectedPolygons[fold.poly.index]

      if (adjacentPoly) {
        results.folds.push(edge)
      } else {
        results.cuts.push(edge)
      }
    }

    polygon.edges.forEach(edge => {
      if (!selectedPolygons[edge.shared.poly.index]) {
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

  selectedPolygons.forEach(({ polygon }) => {
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

  const round = n => Math.round(n * 100) / 100
  const description = element('g', {id: 'description'}, [
    element('text', {
      fill: 'rgba(0, 0, 0, 0.25)',
      'font-size': '.2pt',
      'font-style': 'italic',
      y: viewBoundingBox.y
    }, [
      element('tspan', {x: .25, dy: '-1em'}, [`Polygons: ${selectedPolygons.map(({ polygon }) => polygon.index).join(', ')}`]),
      element('tspan', {x: .25, dy: '-1.2em'}, [`Edge Length: ${round(edgeLength * scale)}cm`]),
      element('tspan', {x: .25, dy: '-1.2em'}, [`Dimensions: ${round(viewBoundingBox.x)}cm x ${round(viewBoundingBox.y)}cm`])
    ])
  ])

  const container = element('svg', {
    id: 'output',
    preserveAspectRatio: 'xMinYMin',
    viewBox: viewbox.join(' '),
    width: `${viewBoundingBox.x}cm`,
    height: `${viewBoundingBox.y}cm`
  }, [
    // element('g', {id: 'calibration', ...strokeRed}, [element('rect', { x: 0, y: 0, width: 2.54, height: 2.54 })]),
    element('g', {id: 'cuts', ...strokeRed}, cuts.map(cut => (
      element('path', { d: directives.line(cut) })
    ))),
    element('g', {id: 'folds', ...strokeBlue}, folds.map(fold => (
      element('path', { d: directives.line(fold) })
    ))),
    element('g', {id: 'stars', ...strokeRed}, selectedPolygons.map(({ polygon }) => (
      element('g', {
        id: `polygon-${polygon.index}-stars`
      }, starPathsByPolygon[polygon.index].map(path => (
        element('path', {
          d: directives.path(path)
        })
      ))
    )))),
    element('g', {id: 'constellations', ...strokeRed}, selectedPolygons.map(({ polygon }) => (
      element('g', {
        id: `polygon-${polygon.index}-asterisms`
      }, (asterismLinesByPolygon[polygon.index] || []).map(line => (
        element('path', { d: directives.line(line.toPoints()) })
      )))
    ))),
    element('g', {id: 'tabs', ...strokeRed}, selectedPolygons.map(({ polygon }) => (
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
    }, selectedPolygons.map(({ polygon, transform }) => {
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
  const key = polygons.length > selectedPolygons.Length
    ? `polygons-${selectedPolygons.map(({ polygon }) => polygon.index).join('-')}`
    : 'full'

  saveLink.style.display = 'block'
  saveLink.href = blobUrl
  saveLink.download = `star-projector-net-${key}.svg`
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

  container.appendChild(description)
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
          const anyEndpointsIncluded = [curve.v0, curve.v3].some(point => tab.poly.containsPoint(point))

          if (!anyPointIncluded) {
            return clipped
          }

          const intersectedEdges = tab.overlapEdges
            .map(edge => curve.intersectLine(edge))
            .filter(intersections => intersections.length > 0)

          if (intersectedEdges.length === 0 && anyEndpointsIncluded) {
            // Some control points lie outside and some lie inside, but there
            // are no intersections with any of the tab edges. This means the
            // curve is fully within the tab and can be coppied as a whole.
            clipped.push(curve.clone())
            return clipped
          }

          tab.overlapEdges.forEach(edge => {
            const intersections = curve.intersectLine(edge)

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
