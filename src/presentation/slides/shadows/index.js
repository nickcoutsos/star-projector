/** @jsx svgJSX */
import { onDrag, getTangentPoints, projectThrough } from './util'

const element = ns => (tagname, attributes={}, ...children) => {
  const node = (ns
    ? document.createElementNS(ns, tagname)
    : document.createElement(tagname)
  )

  Object.keys(attributes || {}).forEach(k => node.setAttribute(k, attributes[k]))
  children.forEach(child => {
    if (!(child instanceof Node)) {
      child = document.createTextNode(child)
    }

    node.appendChild(child)
  })

  return node
}

const svgJSX = element('http://www.w3.org/2000/svg')

export const content = document.createElement('section')

content.dataset.backgroundColor = 'hsla(210, 14%, 33%, 1)'
const viewBoxWidth = 1600
const viewBoxHeight = 900

content.appendChild(
  <svg
    preserveAspectRatio="xMinYMin"
    viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
  >
    <g>
      <rect fill="rgba(255, 255, 235, 1)" x="0" y="0" width="1600" height="900" />
      <rect fill="lightslategrey" x="800" y="0" width="800" height="900" />
      <rect id="wall" fill="slategrey" stroke="slategrey" x="800" y="0" width="20" height="900" />

      <g id="beam-slices" stroke="none" fill="rgba(255, 255, 180, .1)">
        <polyline nvermindfill="hsla(10, 50%, 50%, 1)" />
        <polyline nvermindfill="hsla(30, 50%, 50%, 1)" />
        <polyline nvermindfill="hsla(50, 50%, 50%, 1)" />
        <polyline nvermindfill="hsla(70, 50%, 50%, 1)" />
        <polyline nvermindfill="hsla(90, 50%, 50%, 1)" />
        <polyline nvermindfill="hsla(10, 50%, 50%, 1)" />
        <polyline nvermindfill="hsla(30, 50%, 50%, 1)" />
        <polyline nvermindfill="hsla(50, 50%, 50%, 1)" />
        <polyline nvermindfill="hsla(70, 50%, 50%, 1)" />
        <polyline nvermindfill="hsla(90, 50%, 50%, 1)" />
        <polyline nvermindfill="hsla(10, 50%, 50%, 1)" />
        <polyline nvermindfill="hsla(30, 50%, 50%, 1)" />
        <polyline nvermindfill="hsla(50, 50%, 50%, 1)" />
        <polyline nvermindfill="hsla(70, 50%, 50%, 1)" />
        <polyline nvermindfill="hsla(90, 50%, 50%, 1)" />
      </g>

      <rect id="aperture" fill="lightgrey" x="800" y="400" width="20" height="100" />

      <circle id="lamp" cx="400" cy="450" r="60" stroke="orange" fill="rgba(255, 255, 200, 0.6)" />
      <circle id="lamp-sizer" cx="440" cy="450" r="10" stroke="black" fill="white" />
    </g>
  </svg>
)

const lamp = content.querySelector('#lamp')
const lampSizer = content.querySelector('#lamp-sizer')
const aperture = content.querySelector('#aperture')
const wall = content.querySelector('#wall')


const updateCircle = (element, point) => {
  element.setAttribute('cx', point.x)
  element.setAttribute('cy', point.y)
}

const updatePolyline = (element, points) => {
  const circuit = points.slice().concat(points[0])
  element.setAttribute('points', circuit.map(({x, y}) => `${x},${y}`).join(' '))
}

const getAperturePoints = () => {
  const x = Number(aperture.getAttribute('x')) + 10
  const y = Number(aperture.getAttribute('y'))
  const h = Number(aperture.getAttribute('height'))
  return [ {x, y}, {x, y: y + h} ]
}

onDrag(lamp, ({scaledX, scaledY}) => {
  const cursor = { x: scaledX, y: scaledY }
  update(cursor)
})

const update = point => {
  if (!point) {
    point = {
      x: Number(lamp.getAttribute('cx')),
      y: Number(lamp.getAttribute('cy'))
    }
  }

  const lampRadius = Number(lamp.getAttribute('r'))
  updateCircle(lamp, point)
  updateCircle(lampSizer, {x: point.x - lampRadius, y: point.y})
  updateBeams(point)
}

const updateBeams = (point) => {
  const [apertureUpper, apertureLower] = getAperturePoints()
  const beams = [...content.querySelectorAll('#beam-slices polyline')]
  const lampRadius = Number(lamp.getAttribute('r'))
  const [upper] = getTangentPoints(point, lampRadius, apertureUpper)
  const [, lower] = getTangentPoints(point, lampRadius, apertureLower)

  const dx = (lower.x - upper.x) / 1
  const dy = (lower.y - upper.y) / 1

  for (let i in beams) {
    i = Number(i)
    const t = i / beams.length
    const a = {x: upper.x + t * dx, y: upper.y + t * dy}
    const b = {x: upper.x + (1 - t) * dx, y: upper.y + (1 - t) * dy}
    const projectedPoints = [
      projectThrough(b, apertureUpper),
      projectThrough(a, apertureLower)
    ].sort((a, b) => a.y - b.y)

    updatePolyline(beams[i], [
      lower, upper,
      apertureUpper, 
      ...projectedPoints,
      apertureLower,
      lower
    ])
  }
}

update({x: 700, y: 450})

onDrag(aperture, ({ scaledY }) => {
  const mid = viewBoxHeight / 2
  const dy = Math.abs(scaledY - mid) + 5
  aperture.setAttribute('y', mid - dy)
  aperture.setAttribute('height', dy * 2)
  update()
})

onDrag(wall, ({ scaledX }) => {
  wall.setAttribute('x', scaledX)
  aperture.setAttribute('x', scaledX)
  document.querySelector('rect').setAttribute('x', scaledX)
  document.querySelector('rect').setAttribute('width', 1600 - scaledX)
  update()
})

onDrag(lampSizer, ({scaledX}) => {
  const lampX = Number(lamp.getAttribute('cx'))
  const dx = Math.abs(lampX - scaledX)
  lamp.setAttribute('r', dx)
  update()
})
