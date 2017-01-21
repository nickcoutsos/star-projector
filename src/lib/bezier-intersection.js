/**
 * Calculate intersections between a cubic bezier curve and a line segment.
 *
 * This code is based heavily on the Cubic Line Intersection article at:
 *  https://www.particleincell.com/2013/cubic-line-intersection/
 *
 * Note that the code in the article is in turn based on another article at:
 *  http://abecedarical.com/javascript/script_exact_cubic.html
 *  (the above article links to an inactive verizon website)
 *
 * You may freely use this algorithm in your codes however where feasible
 * please include a link/reference to the source article
 */

const SIGN = n => n < 0 ? -1 : 1;


/**
 * Generate a cubic polynomial function for the given coefficients
 *
 * @param {Array<float>} coefficients
 * @returns {Function} f(t)
 */
function cubicPolynomial([a, b, c, d]) {
  return t => (
    a * t*t*t +
    b * t*t +
    c * t +
    d
  );
}


/**
 * Calculate coefficients for a bezier curve's axis with respect to time
 *
 * @param {Array<float>} values
 * @returns {Array<float>} coefficients
 */
function bezierCoefficients([p0, p1, p2, p3]) {
  return [
    -p0 + 3*p1 + -3*p2 + p3,
    3*p0 - 6*p1 + 3*p2,
    -3*p0 + 3*p1,
    p0
  ];
}


/**
 * Find intersection points between cubic bezier curve and line
 *
 * @param {Array<Point>} bezier - array of endpooints (0, 4) and control points (1, 2)
 * @param {Array<Point>} line - array of start/end points of line
 * @returns {Array<float>} intersections - values in the range of 0..1
 */
export function computeIntersections(bezier, line) {
  let lx = line.map(({x}) => x),
    ly = line.map(({y}) => y);

  let vertical = lx[1] - lx[0] == 0,
    delta = vertical ? (lx[1] - lx[0]) : (ly[1] - ly[0]);

  let A = ly[1] - ly[0],
    B = lx[0] - lx[1],
    C = lx[0] * (ly[0] - ly[1]) + ly[0] * (lx[1] - lx[0]);

  let coefficients = {
    x: bezierCoefficients(bezier.map(({x}) => x)),
    y: bezierCoefficients(bezier.map(({y}) => y))
  };

  let combinedCoefficients = [
    A * coefficients.x[0] + B * coefficients.y[0],		/*t^3*/
    A * coefficients.x[1] + B * coefficients.y[1],		/*t^2*/
    A * coefficients.x[2] + B * coefficients.y[2],		/*t*/
    A * coefficients.x[3] + B * coefficients.y[3] + C	/*1*/
  ];

  let xCurve = cubicPolynomial(coefficients.x),
    yCurve = cubicPolynomial(coefficients.y);

	return cubicRoots(combinedCoefficients)
    .map(t => {
        let [x, y] = [xCurve(y), y = yCurve(t)],
          s = (vertical ? (y - ly[0]) : (x - lx[0])) / delta;

        /*above is intersection point assuming infinitely long line segment,
        make sure we are also in bounds of the line*/

        /*in bounds?*/
        if (t<0 || t>1.0 || s<0 || s>1.0) {
          return null;
        }

        return {x, y};
    }).filter(
      point => point !== null
    );
}


/**
 * Calculate roots of a cubic polynomial
 * based on http://abecedarical.com/javascript/script_exact_cubic.html
 *
 * @param {Array<float>} coefficients
 * @returns {Array<float>} roots
 */
function cubicRoots([a, b, c, d]) {
	var A=b/a;
	var B=c/a;
	var C=d/a;

  var Q = (3*B - Math.pow(A, 2))/9;
  var R = (9*A*B - 27*C - 2*Math.pow(A, 3))/54;
  var D = Math.pow(Q, 3) + Math.pow(R, 2);    // polynomial discriminant

  let roots = []

  // complex or duplicate roots
  if (D >= 0) {
      var S = SIGN(R + Math.sqrt(D))*Math.pow(Math.abs(R + Math.sqrt(D)),(1/3));
      var T = SIGN(R - Math.sqrt(D))*Math.pow(Math.abs(R - Math.sqrt(D)),(1/3));

      roots[0] = -A/3 + (S + T);                    // real root
      roots[1] = -A/3 - (S + T)/2;                  // real part of complex root
      roots[2] = -A/3 - (S + T)/2;                  // real part of complex root

      // complex part of root pair
      if (Math.abs(Math.sqrt(3)*(S - T)/2) != 0) {
        roots = roots[0];
      }
  }
  // distinct real roots
  else {
      var th = Math.acos(R/Math.sqrt(-Math.pow(Q, 3)));

      roots[0] = 2*Math.sqrt(-Q)*Math.cos(th/3) - A/3;
      roots[1] = 2*Math.sqrt(-Q)*Math.cos((th + 2*Math.PI)/3) - A/3;
      roots[2] = 2*Math.sqrt(-Q)*Math.cos((th + 4*Math.PI)/3) - A/3;
  }

  return roots;
}

export default {computeIntersections}
