import { Vector3 } from 'three'
import projections from './projections/async'
import { fourPointStar } from './shapes/star'
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

const projectStars = (topology, stars) => Promise.all(
  stars.map(star => {
    const {rightAscension, declination} = star;
    const direction = vectorFromAngles(rightAscension, declination)
    return projections.vector(topology, direction).then(({polygonId, point}) => {
      if (star.magnitude < 2 || star.connected) {
        return projections.path(topology, fourPointStar, direction)
          .then(paths => ({ paths, point, star }))
      }

      return { star, point, polygonId }
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
      // TODO: ensure segment points aren't offset beyond the line's original length
      // TODO: ensure segment points aren't offset beyond one another
      const [a, b] = segment.edge
      const [a_, b_] = [a, b].map(p => p.clone())
      const length = a.distanceTo(b)
      const STAR_OFFSET = .02 / length
      const EDGE_OFFSET = .008 / length
      const QUAD_THICKNESS = 0.004

      const polygon = topology.polygons[segment.polygonId]
      const cross = polygon.plane.normal
        .clone()
        .cross(b.clone().sub(a))
        .normalize()
        .multiplyScalar(QUAD_THICKNESS / 2)

      a.lerp(b_, pair.some(star => a_.equals(star)) ? STAR_OFFSET : EDGE_OFFSET)
      b.lerp(a_, pair.some(star => b_.equals(star)) ? STAR_OFFSET : EDGE_OFFSET)

      segment.quad = ([
        a.clone().add(cross),
        a.clone().sub(cross),
        b.clone().sub(cross),
        b.clone().add(cross)
      ]).reduce(makeSequence, [])
        .reduce(makePairs, [])
        .reduce((a, b) => a.concat(b))
    })

    return segments
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
