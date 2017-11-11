const findParentNode = (element, selector) => {
  let i = element.parentNode
  while (i && !i.matches(selector)) {
    i = i.parentNode
  }

  return i
}

export const onDrag = (element, listener) => {
  let dragging = false

  element.addEventListener('click', (event) => {
    if (dragging) {
      event.stopImmediatePropagation()
    }
  })

  function move (event) {
    dragging = true
    const svg = findParentNode(element, 'svg')
    const [viewBoxWidth, viewBoxHeight] = svg.getAttribute('viewBox').split(' ').slice(2).map(Number)
    const { width, height, top, left } = svg.getBoundingClientRect()
    const { clientX, clientY } = event.type === 'touchmove'
      ? event.touches[0]
      : event

    listener(Object.assign(event, {
      scaledX: (clientX - left) / width * viewBoxWidth,
      scaledY: (clientY - top) / height * viewBoxHeight
    }))
  }

  function attach () {
    element.classList.add('dragging')
    window.addEventListener('mousemove', move)
    window.addEventListener('touchmove', move)
    window.addEventListener('mouseup', detach)
    window.addEventListener('touchend', detach)
  }

  function detach () {
    setTimeout(() => {dragging = false})
    element.classList.remove('dragging')
    window.removeEventListener('mousemove', move)
    window.removeEventListener('touchmove', move)
    window.removeEventListener('mouseup', detach)
    window.removeEventListener('touchend', detach)
  }

  element.addEventListener('mousedown', attach)
  element.addEventListener('touchstart', attach)
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

export const animateAttribute = (element, attribute, getValue, duration=100) => {
  let direction = 1
  let start_

  function start (newDuration, newDirection) {
    start_ = Date.now()
    if (newDuration) {
      duration = newDuration
    }
    if (newDirection) {
      direction = newDirection
    }

    animate()
  }

  function stop () {
    start_ = undefined
  }

  function animate () {
    const now = Date.now()
    const delta = now - start_
    const f = delta / duration
    const t = Math.max(0, Math.min(1, direction > 0 ? f : (1 - f)))

    if ((t < 1 && direction > 0) || (t > 0 && direction < 0)) {
      requestAnimationFrame(animate)
    } else {
      direction *= -1
      stop()
    }

    element.setAttribute(attribute, getValue(t))
  }

  return start
}
