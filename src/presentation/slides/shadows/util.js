const findParentNode = (element, selector) => {
  let i = element.parentNode
  while (i && !i.matches(selector)) {
    i = i.parentNode
  }

  return i
}

export const onDrag = (element, listener) => {
  function move (event) {
    const svg = findParentNode(element, 'svg')
    const [viewBoxWidth, viewBoxHeight] = svg.getAttribute('viewBox').split(' ').slice(2).map(Number)
    const { width, height, top, left } = svg.getBoundingClientRect()
    const { clientX, clientY } = event

    listener(Object.assign(event, {
      scaledX: (clientX - left) / width * viewBoxWidth,
      scaledY: (clientY - top) / height * viewBoxHeight
    }))
  }

  function attach () {
    element.classList.add('dragging')
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', detach)
  }

  function detach () {
    element.classList.remove('dragging')
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', detach)
  }

  element.addEventListener('mousedown', attach)
}

export const getTangentPoints = (center, radius, point) => {
  const dx = point.x - center.x
  const dy = point.y - center.y
  const angle = Math.atan2(dy, dx)
  const hypotenuse = Math.sqrt(dx*dx + dy*dy)
  const tangentLength = Math.sqrt(Math.pow(hypotenuse, 2) - Math.pow(radius, 2))
  const tangentAngle = Math.acos((
    Math.pow(hypotenuse, 2)
    + Math.pow(radius, 2)
    - Math.pow(tangentLength, 2)
  ) / (
    2 * radius * hypotenuse
  ))

  const a1 = angle - tangentAngle
  const a2 = angle + tangentAngle

  return [
    { x: center.x + radius * Math.cos(a1), y: center.y + radius * Math.sin(a1) },
    { x: center.x + radius * Math.cos(a2), y: center.y + radius * Math.sin(a2) }
  ]
}

export const projectThrough = (source, dest) => {
  const dx = dest.x - source.x
  const dy = dest.y - source.y
  const dist = 100

  return {
    x: source.x + dx * dist,
    y: source.y + dy * dist
  }
}
