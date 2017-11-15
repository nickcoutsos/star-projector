import { DoubleSide, MeshStandardMaterial } from 'three'

export const regular = new MeshStandardMaterial({
  name: 'regular',
  color: 'lightslategray',
  metalness: 0.1,
  roughness: 0.9,
  flatShading: false,
  opacity: 0.7,
  transparent: true,
  side: DoubleSide
})

export const active = new MeshStandardMaterial({
  name: 'active',
  color: 'crimson',
  metalness: 0.1,
  roughness: 0.9,
  flatShading: false,
  opacity: 0.7,
  transparent: true,
  side: DoubleSide
})

export const neighbour = new MeshStandardMaterial({
  name: 'neighour',
  color: 'gold',
  metalness: 0.1,
  roughness: 0.9,
  flatShading: false,
  opacity: 0.7,
  transparent: true,
  side: DoubleSide
})
