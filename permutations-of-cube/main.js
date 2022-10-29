/*global
  createCanvas,
  background,
  WEBGL,
  ortho,
  box,
  translate,
  rotate,
  PI,
  scale,
  frameCount,
  camera,
  fill,
  line,
  stroke,
  createButton,
  strokeWeight
*/
// Add functions to this list that give you a red dot.

let width = 400;
let height = 400;
let r = {
  x:0,
  y:0,
  z:0
}
let cr = {
  x:0,
  y:0,
  z:0
}
function setup(){
  createCanvas(width,height,WEBGL);
  createButton('on-x').mousePressed(() => r.x = r.x + PI/2)
  createButton('on-y').mousePressed(() => r.y = r.y + PI/2)
  createButton('on-z').mousePressed(() => r.z = r.z + PI/2)
}
let delta = .05
function draw(){
  // camera(0,0,frameCoun)
  if (cr.x < r.x) {
    cr.x += delta
  }
  if (cr.x > r.x) {
    cr.x -= delta
  }
  if (abs(cr.x - r.x) <= delta) {
    cr.x = r.x
  }
  
  if (cr.y < r.y) {
    cr.y += delta
  }
  if (cr.y > r.y) {
    cr.y -= delta
  }
  if (abs(cr.z - r.z) <= delta) {
    cr.z = r.z
  }
  
  if (cr.z < r.z) {
    cr.z += delta
  }
  if (cr.z > r.z) {
    cr.z -= delta
  }
  if (abs(cr.z - r.z) <= delta) {
    cr.z = r.z
  }
  background(200)
  scale(100)
  // rotate((frameCount/50)*PI/4, [1,0,0]);
  // rotate(PI/3, [.2,.3,.4])
  fill(0,0,0,0)
  // box(1)
  rotate(cr.x, [1,0,0])
  rotate(cr.y, [0,1,0])
  rotate(cr.z, [0,0,1])
  stroke('black')
  for (let i = 0; i < 4; i++) {
    rotate(PI/2,[1,0,0])
    line(-1,1,1,1,1,1)
    line(1,-1,1,1,1,1)
    line(-1,-1,1,-1,1,1)
    line(-1,-1,1,1,-1,1)
  }
  strokeWeight(2)
  stroke('red')
  line(-1,-1,-1,1,1,1)
  stroke('green')
  line(-1,-1,1,1,1,-1)
  stroke('blue')
  line(-1,1,-1,1,-1,1)
  stroke('yellow')
  line(1,-1,-1,-1,1,1)
  strokeWeight(1)

  
}