import { groupBy } from 'lodash'
import {Box2, CurvePath, Line3, Matrix4, Triangle, Vector3} from 'three';
import hull from 'convexhull-js';

const svgHeader = '<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">'

/**
 * Create a DOM element in the SVG namespace.
 *
 * @param {String} tagname - the element tag name.
 * @param {Object} [attributes={}] a key-value mapping of attributes to add to the node
 * @param {Array<DOMNode>} [children=[]] array of children to append before returning
 * @returns {DOMNode}
 */
export function element(tagname, attributes={}, children=[]) {
  let node = document.createElementNS('http://www.w3.org/2000/svg', tagname)
  Object.keys(attributes).forEach(k => node.setAttribute(k, attributes[k]))
  children.forEach(child => {
    if (!(child instanceof Node)) {
      child = document.createTextNode(child)
    }

    node.appendChild(child)
  })

  return node
}

const lineDirective = ([ a, b ]) => {
  return `M ${a.x},${a.y} L ${b.x},${b.y}`
}

const pathDirective = path => {
  const curveTo = ([, ...points]) => points.map(({ x, y }) => `${x},${y}`).join(' ')
  const curvePoints = path.curves.map(curve => curve.getControlPoints())
  const [ [first] ] = curvePoints

  return `M${first.x},${first.y} C ${curvePoints.map(curveTo).join(' ')}`
}

const asterismEdgeDirective = edges => {
  const [ first, ...rest ] = edges.filter((_, i) => i === 0 || i % 2 !== 0)
  return `M${first.x},${first.y} L ${rest.map(({x, y}) => `${x} ${y}`).join(' ')}`
}

const polyDirective = (poly, close=false) => {
  const [ first, ...rest ] = poly
  return `M${first.x},${first.y} L ${rest.map(({x, y}) => `${x},${y}`).join(' ')} ${close ? 'Z' : ''}`
}

const getUnfoldedEdges = polygons => [].concat(
  ...polygons.map(({ matrix, cuts }) => (
    cuts.map(cut => cut.line
      .clone()
      .applyMatrix4(matrix)
    )
  ))
)

const getUnfoldedHull = edges => (
  hull([].concat(
    ...edges.map(edge => edge.toPoints())
  ))
)

/**
 * Make a rotation matrix to align the longest edge of a hull with the X-axis
 *
 * @param {Array<Vector3>}
 * @returns {Matrix4}
 */
const getOrientationMatrix = points => {
  const longestEdge = points
    .map((v, i, arr) => ([v, arr[(i+1) % arr.length]]))
    .map(edge => new Vector3().subVectors(...edge))
    .reduce((a, b) => b.lengthSq() > a.lengthSq() ? b : a)

  return new Matrix4().makeRotationZ(
    longestEdge.angleTo(new Vector3(1, 0, 0))
  )
}

const getTabAngle = polygon => {
  const [ edge ] = polygon.edges
  const edgeAngle = Math.PI - edge.vector.angleTo(edge.next.vector)
  const innerAngle = edgeAngle > Math.PI
    ? edgeAngle - Math.PI
    : edgeAngle

  const remainingAngle = (2*Math.PI) % innerAngle
  const tabAngle = remainingAngle < 1e-6 ? innerAngle : remainingAngle

  return tabAngle
}

const getTabDimensions = (transformations, polygon) => {
  const edge = polygon.edges[0]
  const tabAngle = getTabAngle(polygon)
  const transform = transformations[polygon.index]
  const transformed = edge.line.clone().applyMatrix4(transform)
  const base = transformed.distance()

  const potentialHeight = base/2 * Math.tan(tabAngle)
  const desiredHeight = base / 10
  const resultingBase = 2 * (potentialHeight - desiredHeight) / Math.tan(tabAngle)
  const baseOffsetFactor = (resultingBase > 0 ? resultingBase : base) / base

  return { desiredHeight, baseOffsetFactor }
}

const getTabMaker = (transformations, polygon) => {
  const { desiredHeight, baseOffsetFactor } = getTabDimensions(transformations, polygon)

  return edge => {
    const transform = transformations[edge.poly.index]
    const transformed = edge.line.clone().applyMatrix4(transform)
    const transformedVector = transformed.delta()

    const outward = transformed.getCenter()
      .sub(edge.poly.center.clone().applyMatrix4(transform))
      .normalize()
      .multiplyScalar(desiredHeight)

    const outerEdgeStart = transformed.at(.5 - baseOffsetFactor/2).add(outward)
    const outerEdgeEnd = transformed.at(.5 + baseOffsetFactor/2).add(outward)

    const targetTransform = transformations[edge.shared.poly.index]
    const targetLine = edge.shared.line.clone().applyMatrix4(targetTransform)
    const targetVector = targetLine.delta().negate()
    const cross = transformedVector.clone().cross(targetVector)

    const rotation = transformedVector.angleTo(targetVector) * (
      Math.abs(cross.z) > 1e-6 ? Math.sign(cross.z) : 1
    )

    const toOrigin = transformed.start.clone().negate()
    const toTargetPoint = targetLine.end.clone()

    const toTarget = new Matrix4()
      .multiply(new Matrix4().makeTranslation(...toTargetPoint.toArray()))
      .multiply(new Matrix4().makeRotationZ(rotation))
      .multiply(new Matrix4().makeTranslation(...toOrigin.toArray()))

    const tabQuad = [transformed.start, outerEdgeStart, outerEdgeEnd, transformed.end]
    const overlapQuad = tabQuad.map(p => p.clone().applyMatrix4(toTarget))
    const triangles = [
      new Triangle(overlapQuad[0], overlapQuad[3], overlapQuad[1]),
      new Triangle(overlapQuad[3], overlapQuad[2], overlapQuad[1])
    ]

    const overlapEdges = [
      new Line3(overlapQuad[0], overlapQuad[1]),
      new Line3(overlapQuad[1], overlapQuad[2]),
      new Line3(overlapQuad[2], overlapQuad[3]),
      new Line3(overlapQuad[3], overlapQuad[0]),
    ]

    return {
      id: edge.id,
      polygonId: edge.poly.index,
      toTab: new Matrix4().getInverse(toTarget),
      quad: tabQuad,
      overlap: overlapQuad,
      overlapEdges,
      poly: {
        containsPoint: (point, excludeEdges=false) => {
          const inTriangles = triangles.some(tri => tri.containsPoint(point))
          const inEdges = overlapEdges.some(edge => edge.containsPoint(point))

          return inTriangles && (!excludeEdges || !inEdges)
        },
        triangles
      }
    }
  }
}

export function drawSVG(polygons, stars, asterisms) {
  const edges = getUnfoldedEdges(polygons)
  const edgeHull = getUnfoldedHull(edges)
  const aaRotation = getOrientationMatrix(edgeHull)
  const boundingBox = new Box2().setFromPoints(
    edgeHull.map(p => p.applyMatrix4(aaRotation))
  )

  // TODO: refactor this section into a function that allows for scaling based
  // on desired radius or edge length or maximum unfolded dimensions
  const offset = boundingBox.min.clone().negate()
  // const scale = 100 / boundingBox.getSize().x
  const scale = 12.584086145276297
  const edgeLength = polygons[0].polygon.edges[0].line.distance()
  const tabHeight = edgeLength / 6
  const padding = tabHeight * 2
  const width = (boundingBox.getSize().x + padding) * scale
  const height = (boundingBox.getSize().y + padding) * scale

  const viewbox = [0, 0, width, height]
  const viewboxTransform = new Matrix4()
    .multiply(new Matrix4().makeScale(scale, scale, 1))
    .multiply(new Matrix4().makeTranslation(offset.x + padding/2, offset.y + padding/2, 0))
    .multiply(aaRotation)

  polygons.forEach(polygon => {
    polygon.toViewbox = polygon.matrix.clone().premultiply(viewboxTransform)
  })

  const transformations = polygons.map(({ toViewbox }) => toViewbox)

  const tabMaker = getTabMaker(transformations, polygons[0].polygon)
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
    width: `${width}cm`,
    height: `${height}cm`
  }, [
    element('g', strokeRed, [element('rect', { x: 0, y: 0, width: 2.54, height: 2.54 })]),
    element('g', strokeRed, cuts.map(cut => (
      element('path', { d: lineDirective(cut) })
    ))),
    element('g', strokeBlue, folds.map(fold => (
      element('path', { d: lineDirective(fold) })
    ))),
    // element('g', strokeRed,
    //   starPaths.map(path => element('path', { d: pathDirective(path) }))
    // ),
    element('g', Object.assign({
      id: 'stars'
    }, strokeRed), polygons.map(({ polygon }) => (
      element('g', {
        id: `polygon-${polygon.index}`
      }, starPathsByPolygon[polygon.index].map(path => (
        element('path', {
          d: pathDirective(path)
        })
      ))
    )))),
    element('g', strokeRed, asterismQuads.map(edge => (
      element('path', { d: lineDirective(edge.toPoints()) })
    ))),
    element('g', strokeRed, tabs.map(({ quad }) => (
      element('path', { d: polyDirective(quad) })
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
