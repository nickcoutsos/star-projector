/** @jsx svgJSX */
import { flatten, times } from 'lodash'
import { onDrag, getTangentPoints, projectThrough, animateAttribute } from './util'

const element = ns => (tagname, attributes={}, ...children) => {
  const node = (ns
    ? document.createElementNS(ns, tagname)
    : document.createElement(tagname)
  )

  Object.keys(attributes || {}).forEach(k => node.setAttribute(k, attributes[k]))
  flatten(children).forEach(child => {
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
  <svg preserveAspectRatio="xMinYMin" viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}>
    <defs>
      <clipPath id="light-clip">
        <circle data-state="off" r="0" />
      </clipPath>
    </defs>

    <rect clip-path="url(#light-clip)" fill="rgba(255, 255, 235, 1)" x="0" y="0" width="1600" height="900" />
    <rect clip-path="url(#light-clip)" id="darkness" fill="lightslategrey" x="800" y="0" width="800" height="900" />

    <rect id="wall" fill="slategrey" stroke="slategrey" x="800" y="0" width="30" height="900" />

    <g clip-path="url(#light-clip)" id="beam-slices" stroke="none" fill="rgba(255, 255, 200, .15)">
      {times(12, () => <polyline />)}
    </g>

    <rect id="aperture" fill="lightgrey" x="800" y="400" width="30" height="100" />

    <circle id="lamp-sizer" data-state="off" cx="400" cy="450" r="80" />
    <circle id="lamp" data-state="off" cx="400" cy="450" r="60" />
    {/*<circle id="lamp-sizer" cx="440" cy="450" r="10" stroke="black" fill="white" />*/}
  </svg>
)

const lamp = content.querySelector('#lamp')
const lampRadius = () => Number(lamp.getAttribute('r'))
const lampSizer = content.querySelector('#lamp-sizer')
const lampClip = content.querySelector('#light-clip circle')
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
  const x = Number(aperture.getAttribute('x')) + 0
  const y = Number(aperture.getAttribute('y'))
  const h = Number(aperture.getAttribute('height'))
  return [ {x, y}, {x, y: y + h} ]
}

onDrag(lamp, ({scaledX, scaledY}) => {
  const cursor = { x: scaledX, y: scaledY }
  update(cursor)
})

const lampToggle = animateAttribute(lampClip, 'r', t => Math.max(0, Math.min(t * t * 2000, 2000)), 50)

lamp.addEventListener('click', () => {
  lamp.dataset.state = lamp.dataset.state === 'on' ? 'off' : 'on'
  lampClip.dataset.state = lampClip.dataset.state === 'on' ? 'off' : 'on'
  lampToggle()
})

const update = point => {
  if (!point) {
    point = {
      x: Number(lamp.getAttribute('cx')),
      y: Number(lamp.getAttribute('cy'))
    }
  }

  updateCircle(lamp, point)
  updateCircle(lampSizer, point)
  updateCircle(lampClip, point)
  updateBeams(point)
}

const updateBeams = (point) => {
  const [apertureUpper, apertureLower] = getAperturePoints()
  const beams = [...content.querySelectorAll('#beam-slices polyline')]
  const [upper] = getTangentPoints(point, lampRadius(), apertureUpper)
  const [, lower] = getTangentPoints(point, lampRadius(), apertureLower)

  const dx = lower.x - upper.x
  const dy = lower.y - upper.y

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
      apertureUpper,
      ...projectedPoints,
      apertureLower
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
  aperture.setAttribute('x', scaledX)
  const darkness = content.querySelector('#darkness')
  wall.setAttribute('x', scaledX)
  darkness.setAttribute('x', scaledX)
  darkness.setAttribute('width', 1600 - scaledX)
  update()
})

onDrag(lampSizer, ({scaledX, scaledY}) => {
  const lampX = Number(lamp.getAttribute('cx'))
  const lampY = Number(lamp.getAttribute('cy'))
  const dx = Math.abs(lampX - scaledX)
  const dy = Math.abs(lampY - scaledY)
  const dist = Math.sqrt(dx*dx + dy*dy)
  lamp.setAttribute('r', dist)
  lampSizer.setAttribute('r', dist + 20)
  update()
})
