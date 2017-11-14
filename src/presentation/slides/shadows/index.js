/** @jsx svg */
import { svg } from '../jsx'
import { times } from 'lodash'
import { onDrag, getTangentPoints, projectThrough, animateAttribute } from './util'

const state = {
  lamp: {
    on: false,
    radius: 80,
    x: 400,
    y: 450
  },
  wall: {
    x: 800
  },
  aperture: {
    radius: 50
  }
}

const viewBoxWidth = 1600
const viewBoxHeight = 900
const clickOn = new Audio('assets/click-on.wav')
const clickOff = new Audio('assets/click-off.wav')

export const deactivate = () => {
  if (state.lamp.on) {
    state.lamp.on = false
    clickOff.play()
    lampToggle()
    update()
  }
}

export const content = document.createElement('section')

const render = () => {
  const { lamp, wall, aperture } = state

  const lampState = lamp.on ? 'on' : 'off'

  return (
    <svg preserveAspectRatio="xMinYMin" viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}>
      <defs>
        <clipPath id="light-clip">
          <circle data-state={lampState} r="0" />
        </clipPath>
      </defs>

      <rect clip-path="url(#light-clip)" fill="rgba(255, 255, 235, 1)" x="0" y="0" width="1600" height="900" />
      <rect clip-path="url(#light-clip)" id="darkness" fill="lightslategrey" x={wall.x} y="0" width="800" height="900" />

      <rect id="wall" fill="slategrey" stroke="slategrey" x={wall.x} y="0" width="30" height="900" />

      <g clip-path="url(#light-clip)" id="beam-slices" stroke="none" fill="rgba(255, 255, 200, .15)">
        {times(12, () => <polyline />)}
      </g>

      <rect id="aperture" fill="lightgrey" x={wall.x} y="400" width="30" height={aperture.radius * 2} />

      <circle id="lamp-sizer" data-state={lampState} cx={lamp.x} cy={lamp.y} r={lamp.radius + 20} />
      <circle id="lamp" data-state={lampState} cx={lamp.x} cy={lamp.y} r={lamp.radius} />
    </svg>
  )
}


content.dataset.backgroundColor = 'hsla(210, 14%, 33%, 1)'

content.appendChild(render())

const lamp = content.querySelector('#lamp')
const lampSizer = content.querySelector('#lamp-sizer')
const lampClip = content.querySelector('#light-clip circle')
const aperture = content.querySelector('#aperture')
const wall = content.querySelector('#wall')


const updateCircle = (element, circle) => {
  element.setAttribute('cx', circle.x)
  element.setAttribute('cy', circle.y)

  if (circle.radius) {
    element.setAttribute('r', circle.radius)
  }
}

const updatePolyline = (element, points) => {
  const circuit = points.slice().concat(points[0])
  element.setAttribute('points', circuit.map(({x, y}) => `${x},${y}`).join(' '))
}

const getAperturePoints = () => {
  const x = state.wall.x
  const y = viewBoxHeight / 2 - state.aperture.radius
  const h = state.aperture.radius * 2
  return [ {x, y}, {x, y: y + h} ]
}

onDrag(lamp, ({scaledX, scaledY}) => {
  state.lamp.x = scaledX
  state.lamp.y = scaledY
  update()
})

const lampToggle = animateAttribute(lampClip, 'r', t => Math.max(0, Math.min(t * t * 2000, 2000)), 50)

lamp.addEventListener('click', () => {
  state.lamp.on = !state.lamp.on

  if (state.lamp.on) {
    clickOn.play()
  } else {
    clickOff.play()
  }

  lampToggle()
  update()
})

const update = () => {
  const {x, y, radius} = state.lamp
  const point = {x, y}

  content.querySelector('svg').dataset.state = state.lamp.on ? 'on' : 'off'
  // lampClip.dataset.state = state.lamp.on ? 'on' : 'off'
  // lampSizer.dataset.state = state.lamp.on ? 'on' : 'off'

  updateCircle(lamp, {x, y, radius})
  updateCircle(lampSizer, {x, y, radius: radius + 20})
  updateCircle(lampClip, {x, y})
  updateBeams(point)

  aperture.setAttribute('y', viewBoxHeight / 2 - state.aperture.radius)
  aperture.setAttribute('height', state.aperture.radius * 2)

  const darkness = content.querySelector('#darkness')
  aperture.setAttribute('x', state.wall.x)
  wall.setAttribute('x', state.wall.x)
  darkness.setAttribute('x', state.wall.x)
  darkness.setAttribute('width', viewBoxWidth - state.wall.x)
}

const updateBeams = (point) => {
  const [apertureUpper, apertureLower] = getAperturePoints()
  const beams = [...content.querySelectorAll('#beam-slices polyline')]
  const [upper] = getTangentPoints(point, state.lamp.radius, apertureUpper)
  const [, lower] = getTangentPoints(point, state.lamp.radius, apertureLower)

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

update()

onDrag(aperture, ({ scaledY }) => {
  const mid = viewBoxHeight / 2
  const dy = Math.abs(scaledY - mid) + 5

  state.aperture.radius = dy
  update()
})

onDrag(wall, ({ scaledX }) => {
  state.wall.x = scaledX
  update()
})

onDrag(lampSizer, ({scaledX, scaledY}) => {
  const lampX = state.lamp.x
  const lampY = state.lamp.y
  const dx = Math.abs(lampX - scaledX)
  const dy = Math.abs(lampY - scaledY)
  const dist = Math.sqrt(dx*dx + dy*dy)
  state.lamp.radius = dist
  update()
})
