/** @jsx jsx */
import { chunk, find, flatten } from 'lodash'
import * as three from 'three'
import { jsx } from '../jsx'
import Topology from '../../../topology'
import * as projections from '../../../projections'
import Viewer from '../../components/viewer'
import Trackball from '../../components/trackball'
import * as elements from './elements'
import * as materials from './materials'
import { animate } from './animate'
import constellation from './constellation'
import cylinderLine from './cylinder-line'

const geometry = new three.DodecahedronGeometry()
const topology = new Topology(geometry)


const viewer = new Viewer()
const trackball = new Trackball(viewer)

const style = obj => Object.keys(obj).map(key => `${key}: ${obj[key]}`).join('; ')

export const content = (
  <section style="text-align: left">
    <h3>Projection</h3>
    <ul>
      <li class="fragment">Declination</li>
      <li class="fragment">Right Ascension</li>
      <li class="fragment">Intersection</li>
      <li class="fragment">More Stars</li>
      <li class="fragment">
        Lines!
        <ul>
          <li class="fragment">... lines spanning edges</li>
          <li class="fragment">More intersections!</li>
          <li class="fragment">The only constellation that isn't dumb</li>
        </ul>
      </li>
    </ul>
  </section>
)

const renderContainer = (
  <div
      id="renderer"
      style={style({
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh'
      })}
    />
)

const wrapper = new three.Object3D().add(
  ...elements.getFaces(topology)
)

viewer.mount(renderContainer)
viewer.scene.add(wrapper)
viewer.camera.position.set(1.6, 0, .2)
viewer.camera.lookAt(new three.Vector3())

trackball.on('rotate', rotation => {
  wrapper.applyMatrix(rotation)
  viewer.renderFrame()
})

const wrongLine = new three.Object3D()
const starObjects = new three.Object3D()
const starLines = new three.Object3D()
const arrow = new three.ArrowHelper(
  new three.Vector3(0, 1, 0),
  new three.Vector3(0, 0, 0),
  1.3, 0xff0000, .1, .1
)

arrow.visible = false
wrongLine.visible = false
wrapper.add(arrow, starObjects, starLines, wrongLine)

export const activate = () => {
  document.body.appendChild(renderContainer)
  viewer.onResize()
  trackball.attach()
}

export const deactivate = () => {
  document.body.removeChild(renderContainer)
  trackball.detach()
}

export const showFragment = ({index}) => {
  constellation.then(({stars}) => {
    const [star] = stars
    const {rightAscension, declination} = star

    switch (index) {
      case 0:
        arrow.visible = true
        animate(t => {
          arrow.setDirection(vectorFromAngles(0, declination + Math.PI/2 * (1-t)))
          viewer.renderFrame()
        }, 200)()
        break

      case 1:
        animate(t => {
          arrow.setDirection(vectorFromAngles(rightAscension * t, declination))
          viewer.renderFrame()
        }, 200)()
        break

      case 2:
        arrow.visible = false
        starObjects.children[0].visible = true
        viewer.renderFrame()
        break

      case 3:
        starObjects.children.slice(1).forEach((star, i) => {
          setTimeout(() => {
            star.visible = true
            viewer.renderFrame()
          }, 50 * (i+1))
        })
        break

      case 4:
        starLines.children[0].visible = true
        viewer.renderFrame()
        break

      case 5:
        wrongLine.visible = true
        viewer.renderFrame()
        break

      case 6:
        wrongLine.visible = false
        starLines.children[9].visible = true
        viewer.renderFrame()
        break

      case 7:
        starLines.children.forEach((obj, i) => {
          setTimeout(() => {
            obj.visible = true
            viewer.renderFrame()
          }, 50 * (i+1))
        })
        break
    }
  })
}

export const hideFragment = ({index}) => {
  constellation.then(({stars}) => {
    const [star] = stars
    const {rightAscension, declination} = star

    switch (index) {
      case 0:
        arrow.visible = false
        break

      case 1:
        animate(t => {
          arrow.setDirection(vectorFromAngles(rightAscension * (1-t), declination))
          viewer.renderFrame()
        }, 200)()
        break

      case 2:
        arrow.visible = true
        starObjects.children[0].visible = false
        viewer.renderFrame()
        break

      case 3:
        starObjects.children.slice(1).forEach((star, i) => {
          setTimeout(() => {
            star.visible = false
            viewer.renderFrame()
          }, 50 * (i+1))
        })
        break

      case 4:
        starLines.children[0].visible = false
        viewer.renderFrame()
        break

      case 5:
        wrongLine.visible = false
        viewer.renderFrame()
        break

      case 6:
        wrongLine.visible = true
        starLines.children[9].visible = false
        viewer.renderFrame()
        break

      case 7:
        starLines.children.forEach((obj, i) => {
          setTimeout(() => {
            obj.visible = false
            viewer.renderFrame()
          }, 50 * (i+1))
        })
        break
    }
  })
}

function vectorFromAngles(theta, phi) {
  return new three.Vector3(
    Math.cos(phi) * Math.sin(theta),
    Math.sin(phi),
    Math.cos(phi) * Math.cos(theta)
  ).normalize();
}

constellation.then(({stars, pairs}) => {
  const starPoints = stars.map(({ id, declination, rightAscension }) => {
    const vector = vectorFromAngles(rightAscension, declination)
    const {point} = projections.vector(topology, vector)
    return { id, point }
  })

  const starPairs = chunk(flatten(pairs).map(id => {
    return find(starPoints, {id}).point
  }), 2)

  starPoints.forEach(({ id, point }) => {
    const star = new three.Mesh(
      new three.IcosahedronGeometry(.007, 2),
      materials.star
    )

    star.position.copy(point)
    star.userData.starId = id
    star.visible = false
    starObjects.add(star)
  })

  wrongLine.add(cylinderLine(...starPairs[9], .0025, materials.error))

  starPairs.forEach(pair => {
    const lineObject = new three.Object3D()
    projections.line(topology, ...pair).forEach(({ edge }) => {
      lineObject.add(cylinderLine(...edge, .0025, materials.star))
    })

    lineObject.visible = false
    starLines.add(lineObject)
  })
})
