import { DoubleSide, MeshStandardMaterial } from 'three'

export const space = new MeshStandardMaterial({
  name: 'space',
  color: 'steelblue',
  metalness: 0.1,
  roughness: 0.9,
  flatShading: false,
  transparent: true,
  opacity: 0.85
})

export const star = new MeshStandardMaterial({
  name: 'star',
  color: 'white',
  metalness: 0.1,
  roughness: 0.9,
  flatShading: false,
  side: DoubleSide
})

export const error = new MeshStandardMaterial({
  name: 'error',
  color: 'crimson',
  metalness: 0.1,
  roughness: 0.9,
  flatShading: false,
  side: DoubleSide
})
