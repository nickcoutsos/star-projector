import {Vector3} from 'three'

Vector3.prototype.toArray = function() {
  return [this.x, this.y, this.z]
}
