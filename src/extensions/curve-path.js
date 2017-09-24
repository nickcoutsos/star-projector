import {CubicBezierCurve3, CurvePath, Vector3} from 'three'
import parseSvgPath from 'parse-svg-path'
import './cubic-bezier-curve'

const coords = (points, value) => {
  let last = points[points.length - 1]
  if (!last || last.components === 2) {
    last = new Vector3()
    last.components = 0
    points.push(last)
  }

  last.setComponent(last.components, value)
  last.components += 1
  return points
}

CurvePath.prototype.clone = function() {
  const cloned = new CurvePath()
  this.curves.forEach(curve => cloned.add(curve.clone()))
  return cloned
}

CurvePath.prototype.applyMatrix4 = function(matrix) {
  this.curves.forEach(curve => curve.applyMatrix4(matrix))
  return this
}

CurvePath.prototype.getLineSegments = function(divisions) {
  return this
    .createPointsGeometry(divisions).vertices
    .reduce((segments, p, i, array) => {
      if (i < array.length - 1) {
        segments.push(p, array[i + 1])
      }
      return segments
    }, [])
}

CurvePath.prototype.toArray = function() {
  return this.curves.map(curve => curve.toArray())
}

CurvePath.fromArray = function(curves) {
  const path = new CurvePath()

  curves.map(curve => path.add(CubicBezierCurve3.fromArray(curve)))

  return path
}

CurvePath.fromSvg = function(description) {
  const descriptions = parseSvgPath(description)
  const path = new CurvePath()
  const start = new Vector3()

  path.autoClose = false

  descriptions.forEach(([command, ...args]) => {
    switch(command) {
      case 'M': {
        start.set(...args)
        break;
      }

      case 'm': {
        start.add(new Vector3(...args))
        break
      }

      case 'c': {
        const points = [
          start.clone(),
          ...args
            .reduce(coords, [])
            .map(point => point.add(start))
        ]

        path.add(new CubicBezierCurve3(...points))
        start.copy(points[ points.length - 1 ])

        break
      }

      case 'C': {
        const points = [
          start.clone(),
          ...args.reduce(coords, [])
        ]

        path.add(new CubicBezierCurve3(...points))
        start.copy(points[ points.length - 1 ])

        break
      }

      case 's': {
        const points = [
          start.clone(),
          path.curves[ path.curves.length - 1 ].v2.clone(),
          ...args
            .reduce(coords, [])
            .map(p => p.add(start))
        ]

        path.add(new CubicBezierCurve3(...points))
        start.copy(points[ points.length - 1 ])

        break
      }

      case 'S': {
        const points = [
          start.clone(),
          path.curves[ path.curves.length - 1 ].v2.clone(),
          ...args.reduce(coords, [])
        ]

        path.add(new CubicBezierCurve3(...points))
        start.copy(points[ points.length - 1 ])

        break
      }

      case 'l': {
        const [end] = start.clone().add(args.reduce(coords, []))
        const points = [
          start.clone(),
          start.clone().lerp(end, .25),
          start.clone().lerp(end, .75),
          end
        ]

        path.add(new CubicBezierCurve3(...points))
        start.copy(end)

        break
      }

      case 'L': {
        const [end] = args.reduce(coords, [])
        const points = [
          start.clone(),
          start.clone().lerp(end, .25),
          start.clone().lerp(end, .75),
          end
        ]

        path.add(new CubicBezierCurve3(...points))
        start.copy(end)

        break
      }

      case 'z': {
        path.autoClose = true

        break
      }
    }
  })

  return path
}
