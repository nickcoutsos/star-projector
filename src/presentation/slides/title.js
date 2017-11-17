/** @jsx plainJSX */
import 'plain-jsx'

const intro = new Audio('presentation/assets/cosmos.m4a')

export const content = (
  <section
    data-state="title"
    data-transition="fade-in fade-out"
    data-transition-speed="slow"
    data-background="radial-gradient(circle at center, darkred 0, rgba(0, 0, 0, 0) 60%), url(presentation/assets/hudf_300dpi.jpg)"
    data-background-size="cover"
  >
    <h1>Star Projector</h1>
    <h2 class="fragment" style="transition: 3s ease-in">
      A Personal Voyage
    </h2>
  </section>
)

export const activate = () => {
  intro.volume = 1
  intro.play()
}

export const deactivate = () => {
  let t = 0
  const fade = () => {
    t += 16 / 2000
    intro.volume = 1 - t

    if (t < 1) {
      requestAnimationFrame(fade)
    } else {
      intro.pause()
    }
  }

  fade()
}
