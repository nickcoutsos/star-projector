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

export function drawSVG(polygons, stars, asterisms) {
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

  const viewbox = [0, 0, viewBoundingBox.x, viewBoundingBox.y]
  const viewboxTransform = new Matrix4()
    .multiply(new Matrix4().makeScale(availableScale, availableScale, 1))
    .multiply(new Matrix4().makeTranslation(offset.x + padding, offset.y + padding, 0))
    .multiply(aaRotation)

  polygons.forEach(polygon => {
    polygon.toViewbox = polygon.matrix.clone().premultiply(viewboxTransform)
  })

  const transformations = polygons.map(({ toViewbox }) => toViewbox)
  const tabMaker = getTabMaker(transformations, tabScale, polygons[0].polygon)
  const tabs = [].concat(...polygons.map(({cuts}) => cuts))
    .reduce((tabs, cut) => {
      const existing = tabs.find(edge => edge.id === cut.id)
      if (!existing) {
        tabs.push(tabMaker(cut))
      }

      return tabs
    }, [])

  const { cuts, folds } = polygons.reduce((results, { cuts, fold }, polygonId) => {
    const transform = transformations[polygonId]
    const mapEdge = edge => edge.line.clone().applyMatrix4(transform).toPoints()

    fold && results.folds.push(mapEdge(fold))
    cuts.forEach(cut => {
      // render edges with tabs defined as folds instead of cuts
      const container = tabs.find(tab => tab.id === cut.id && tab.polygonId === polygonId)
        ? results.folds
        : results.cuts

      container.push(mapEdge(cut))
    })

    return results
  }, { cuts: [], folds: [] })

  const starPaths = stars.reduce((results, { paths }) => {
    paths.forEach(path => {
      const { polygonId } = path
      const { polygon } = polygons[polygonId]
      const transform = transformations[polygonId]
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

  const asterismQuads = asterisms.reduce((results, { polygonId, quad }) => {
    const { polygon } = polygons[polygonId]
    const transform = transformations[polygonId]
    const mapped = quad.map(p => p.clone().applyMatrix4(transform))
    const mappedLines = [
      new Line3(mapped[0], mapped[1]),
      new Line3(mapped[2], mapped[3]),
      new Line3(mapped[4], mapped[5]),
      new Line3(mapped[6], mapped[7])
    ]

    const result = mappedLines
    const potentialOverlaps = tabs.filter(tab => (
      tab.polygonId !== polygonId &&
      polygon.edges.some(edge => edge.id === tab.id)
    ))

    potentialOverlaps.forEach(tab => {
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
          result.push(edge.clone().applyMatrix4(tab.toTab))
          return
        }

        const [insidePoint] = insidePoints
        const intersectionPoints = tab.overlapEdges
          .map(boundary => boundary.intersectLine(edge))
          .filter(point => !!point)

        if (intersectionPoints.length > 1) {
          intersectionPoints.sort((a, b) => (
            insidePoint.distanceToSquared(a) -
            insidePoint.distanceToSquared(b)
          ))
        }

        result.push(
          new Line3(insidePoint, intersectionPoints[0])
            .clone().applyMatrix4(tab.toTab)
        )
      })
    })

    return [...results, ...result]
  }, [])

  const starPathsByPolygon = groupBy(starPaths, 'polygonId')
  // const asterismQuadsByPolygon = groupBy(asterismQuads, 'polygonId')

  const stroke = { 'stroke-width': '0.01pt', fill: 'none' }
  const strokeRed = Object.assign({}, stroke, { stroke: 'red' })
  const strokeBlue = Object.assign({}, stroke, { stroke: 'blue' })

  const container = element('svg', {
    id: 'output',
    preserveAspectRatio: 'xMinYMin',
    viewBox: viewbox.join(' '),
    width: `${viewBoundingBox.x}cm`,
    height: `${viewBoundingBox.y}cm`
  }, [
    element('g', strokeRed, [element('rect', { x: 0, y: 0, width: 2.54, height: 2.54 })]),
    element('g', strokeRed, cuts.map(cut => (
      element('path', { d: directives.line(cut) })
    ))),
    element('g', strokeBlue, folds.map(fold => (
      element('path', { d: directives.line(fold) })
    ))),
    // element('g', strokeRed,
    //   starPaths.map(path => element('path', { d: directives.path(path) }))
    // ),
    element('g', Object.assign({
      id: 'stars'
    }, strokeRed), polygons.map(({ polygon }) => (
      element('g', {
        id: `polygon-${polygon.index}`
      }, starPathsByPolygon[polygon.index].map(path => (
        element('path', {
          d: directives.path(path)
        })
      ))
    )))),
    element('g', strokeRed, asterismQuads.map(edge => (
      element('path', { d: directives.line(edge.toPoints()) })
    ))),
    element('g', strokeRed, tabs.map(({ quad }) => (
      element('path', { d: directives.poly(quad) })
    ))),
    element('g', {
      id: 'polygon-labels',
      fill: 'none',
      stroke: 'magenta',
      'stroke-width': '.02pt',
      'font-family': 'Garamond',
      'font-size': '1pt',
      'text-anchor': 'middle'
    }, polygons.map(({ polygon, toViewbox }, i) => {
      const center = polygon.center.clone().applyMatrix4(toViewbox)
      return element('text', {
        x: center.x,
        y: center.y,
        dy: '.25pt'
      }, [i])
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
