import {Face3} from 'three'

Face3.prototype.toArray = function() {
  return [
    this.a,
    this.b,
    this.c
  ]
}
