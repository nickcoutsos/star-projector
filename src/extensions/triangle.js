import {Triangle} from 'three'

Triangle.prototype.toArray = function() {
  return [
    this.a,
    this.b,
    this.c
  ]
}
