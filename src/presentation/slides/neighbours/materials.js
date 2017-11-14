import { FrontSide, MeshStandardMaterial } from 'three'


export const regular = new MeshStandardMaterial({
  name: 'regular',
  color: 'lightslategray',
  metalness: 0.1,
  roughness: 0.9,
  flatShading: false
})

export const active = new MeshStandardMaterial({
  name: 'active',
  color: 'crimson',
  metalness: 0.1,
  roughness: 0.9,
  flatShading: false
})

export const neighbour = new MeshStandardMaterial({
  name: 'neighour',
  color: 'gold',
  metalness: 0.1,
  roughness: 0.9,
  flatShading: false
})