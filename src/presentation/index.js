import Reveal from 'reveal.js'

import slides from './slides'
import './style.css'
import 'reveal.js/css/reveal.css'
import 'reveal.js/css/theme/sky.css'

const slideDeck = document.querySelector('.reveal .slides')
slides.forEach(slide => {
  slideDeck.appendChild(slide.content)
})

Reveal.initialize()

slides[0].activate && slides[0].activate()

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
