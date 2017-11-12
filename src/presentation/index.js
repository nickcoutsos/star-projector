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
  touch: false
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
  if (!slide || !slide.showFragment) {
    return
  }

  const fragments = flatten(slide.content.querySelectorAll('.fragment'))
  const index = fragments.findIndex(fragmentElement => fragmentElement === fragment)

  slide.showFragment({ fragment, index })
})

Reveal.addEventListener('fragmenthidden', ({ fragment }) => {
  const slide = activeSlide()
  if (!slide || !slide.hideFragment) {
    return
  }

  const fragments = flatten(slide.content.querySelectorAll('.fragment'))
  const index = fragments.findIndex(fragmentElement => fragmentElement === fragment)

  slide.hideFragment({ fragment, index })
})
