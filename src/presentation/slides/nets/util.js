export const linear = t => t

// t: current time, b: begInnIng value, c: change In value, d: duration
export const easeOutBounce = t => {
  if (t < 1/2.75) {
    return 7.5625*t*t
  } else if (t < (2/2.75)) {
    return 7.5625*(t-=(1.5/2.75))*t + .75;
  } else if (t < (2.5/2.75)) {
    return 7.5625*(t-=(2.25/2.75))*t + .9375
  } else {
    return 7.5625*(t-=(2.625/2.75))*t + .984375
  }
}

export const animate = (frame, duration = 100, timingFunction = linear) => {
  let direction = 1
  let start_
  let callback_

  function start (callback = () => {}) {
    start_ = Date.now()
    callback_ = callback
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

    frame(timingFunction(t))

    if ((t < 1 && direction > 0) || (t > 0 && direction < 0)) {
      requestAnimationFrame(animate)
    } else {
      stop()
      callback_()
      return
    }

  }

  return start
}
