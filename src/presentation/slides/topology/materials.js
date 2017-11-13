import { MeshStandardMaterial } from 'three'

export const regular = new MeshStandardMaterial({
  color: 'lightslategray',
  metalness: 0.1,
  roughness: 0.9,
  flatShading: false
})

export const active = new MeshStandardMaterial({
  color: 'crimson',
  metalness: 0.1,
  roughness: 0.9,
  flatShading: false
})

export const neighbour = new MeshStandardMaterial({
  color: 'gold',
  metalness: 0.1,
  roughness: 0.9,
  flatShading: false
})
