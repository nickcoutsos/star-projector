import { Vector3 } from 'three'
import projections from './projections/async'
import { fourPointStar } from './shapes/star'
import circle from './shapes/circle'
import { loadStarCatalog, loadAsterismCatalog } from './database'
export { loadStarCatalog, loadAsterismCatalog }

function vectorFromAngles(theta, phi) {
  return new Vector3(
    Math.cos(phi) * Math.sin(theta),
    Math.sin(phi),
    Math.cos(phi) * Math.cos(theta)
  ).normalize();
}

export const getProjectedStars = (topology, starQuery, asterismQuery) => (
  Promise.all([
    loadStarCatalog(starQuery),
    loadAsterismCatalog(asterismQuery)
  ])
  .then(([stars, asterisms]) => {
    const connectedStars = [
      ...new Set([].concat(
        ...asterisms.map(a => a.stars))
      )
    ]

    stars.forEach(star => Object.assign(star, {
      connected: connectedStars.indexOf(star.id) > -1
    }))

    return projectStars(topology, stars).then(stars => (
      projectAsterisms(topology, stars, asterisms)
        .then(asterisms => ({ stars, asterisms }))
    ))
  })
)

const scaleFromArc = (arc, distance) => {
  return distance * Math.tan(Math.PI * arc / 180)
}

const projectStars = (topology, stars) => Promise.all(
  stars.map(star => {
    const {rightAscension, declination} = star;
    const direction = vectorFromAngles(rightAscension, declination)
    return projections.vector(topology, direction).then(({ point }) => {
      const shape = star.magnitude < 2 || star.connected
        ? fourPointStar
        : circle

      const arc = (13 - star.magnitude) / 15 * .2864 + .4774
      const scale = scaleFromArc(arc, point.length())
      const angle = star.id % (2*Math.PI)
      return projections.path(topology, shape, direction, { scale, angle })
        .then(paths => ({ paths, point, star }))
    })
  })
)

const projectAsterisms = (topology, projectedStars, asterisms) => (
  Promise.all(asterisms.map(asterism => {
    const pairs = asterism.stars
      .map(id => projectedStars.find(s => s.star.id === id).point)
      .reduce(makePairs, [])

    return Promise.all(pairs.map(pair => projectAsterismLine(topology, pair)))
      .then(segments => [].concat(...segments))
      .then(segments => segments.map(segment => Object.assign(
        {asterism}, segment
      )))
  }))
  .then(segments => [].concat(...segments))
)

const projectAsterismLine = (topology, pair) => (
  projections.line(topology, ...pair).then(segments => {
    segments.forEach(segment => {
      segment.edge = segment.edge.map(p => p.clone())
      const [a, b] = segment.edge
      const [a_, b_] = [a, b].map(p => p.clone())
      const length = a.distanceTo(b)
      const STAR_OFFSET = .0225 / length
      const EDGE_OFFSET = .008 / length
      const QUAD_ARC = .32
      const QUAD_THICKNESS = scaleFromArc(QUAD_ARC, a.length())

      const aLerpDist = pair.some(star => a_.equals(star)) ? STAR_OFFSET : EDGE_OFFSET
      const bLerpDist = pair.some(star => b_.equals(star)) ? STAR_OFFSET : EDGE_OFFSET

      if (Math.max(aLerpDist, bLerpDist) > .5) {
        return
      }

      const polygon = topology.polygons[segment.polygonId]
      const cross = polygon.plane.normal
        .clone()
        .cross(b.clone().sub(a))
        .normalize()
        .multiplyScalar(QUAD_THICKNESS / 2)

      a.lerp(b_, aLerpDist, .5)
      b.lerp(a_, bLerpDist, .5)

      segment.quad = ([
        a.clone().add(cross),
        a.clone().sub(cross),
        b.clone().sub(cross),
        b.clone().add(cross)
      ]).reduce(makeSequence, [])
        .reduce(makePairs, [])
        .reduce((a, b) => a.concat(b))
    })

    return segments.filter(segment => segment.quad)
  })
)

const makePairs = (pairs, value) => {
  let pair = pairs[pairs.length - 1]
  if (!pair || pair.length === 2) {
    pairs.push(pair = [])
  }

  pair.push(value)
  return pairs
}

const makeSequence = (collected, value, i, values) => {
  collected.push(value)
  collected.push(values[(i + 1) % values.length])
  return collected
}
