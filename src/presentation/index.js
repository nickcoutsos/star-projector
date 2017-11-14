import Reveal from 'reveal.js'
import { flatten } from 'lodash'

import slides from './slides'
import './style.css'
import 'reveal.js/css/reveal.css'
import 'reveal.js/css/theme/sky.css'

const slideDeck = document.querySelector('.reveal .slides')
slides.forEach(slide => {
  slideDeck.appendChild(slide.content)
})

Reveal.initialize({
  touch: false,
  minScale: 1,
  maxScale: 1
})

slides[0].activate && slides[0].activate()

const activeSlide = () => {
  const node = document.querySelector('.slides .present')
  return slides.find(slide => slide.content === node)
}

Reveal.addEventListener('slidechanged', ({ currentSlide, previousSlide }) => {
  const current = slides.find(slide => slide.content === currentSlide)
  const previous = slides.find(slide => slide.content === previousSlide)

  if (previous && previous.deactivate) {
    previous.deactivate()
  }

  if (current && current.activate) {
    current.activate()
  }
})

Reveal.addEventListener('fragmentshown', ({ fragment }) => {
  const slide = activeSlide()
  if (!slide) {
    return
  }

  const fragments = flatten(slide.content.querySelectorAll('.fragment'))
  const index = fragments.findIndex(fragmentElement => fragmentElement === fragment)

  slide.showFragment && slide.showFragment({ fragment, index })
  slide.fragment && slide.fragment({ fragment, index })
})

Reveal.addEventListener('fragmenthidden', ({ fragment }) => {
  const slide = activeSlide()
  if (!slide) {
    return
  }

  const fragments = flatten(slide.content.querySelectorAll('.fragment'))
  const index = fragments.findIndex(fragmentElement => fragmentElement === fragment)

  slide.hideFragment && slide.hideFragment({ fragment, index })
  slide.fragment && index > 0 && slide.fragment({ index: index - 1, fragment: fragments[index - 1] })
})
