/*global
  createCanvas,
  background,
  scale,
  line,
  circle,
  push,
  pop,
  fill,
  translate,
  max,
  frameCount,
  stroke
*/
// Add functions to this list that give you a red dot.

const width = 800;
const height = 200;

function setup() {
  createCanvas(width, height);
}

const row = y => {
  line(0,y,width,y)
}
function shuffle(array) {
  let currentIndex = array.length,  randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex != 0) {

    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}
const CEOAScale = 20
const rate = 20
const range = n => ([...Array(n)].map((_,idx) => idx));
const numRows = 8

const findMin = n=>range(n).map(v=>[[v,v+1]])
const A = range(numRows).reduce((acc,cur)=>[...acc,...findMin(numRows-cur)],[])
console.log(A)
// const A = [
//   [
//     [0,1],
//     [2,3],
//     [4,5],
//     [6,7],
//     [8,9],
//     [10,11],
//     [12,13],
//     [14,15],
//   ],
//   [
//     [1,3],
//     [5,7],
//     [9,11],
//     [13,15],
//   ],
//   [
//     [3,7],
//     [11,15],
//   ],
//   [
//     [7,15]
//   ]
// ]

const max = (a,b) => a > b ? a : b
const min = (a,b) => a < b ? a : b
const Anorm = A.map((ops,t) => [ops.map(([i,j]) => [i*CEOAScale,j*CEOAScale]), t*CEOAScale])

const N = A.reduce(
  (acc,ops) => [...acc, ...ops.reduce(
    (acc,op) => [...acc, ...op],[])],[]).reduce(
      (acc,v) => max(acc,v)
)

const state = shuffle([...Array(N+1)].map((_,idx) => idx))

let t = 0
function draw() {
  if (frameCount > t*rate) {
    A[t].forEach(([i,j]) => {
      const smallIdx = min(i,j)
      const largeIdx = max(i,j)
      if (state[smallIdx] > state[largeIdx]) {
        [state[smallIdx],state[largeIdx]] = [state[largeIdx],state[smallIdx]]
      }
    })
    t++
  }
  background(200);
  translate(0,10);
  
  [...Array(N+1)].map((_,idx) => idx*CEOAScale).forEach(rowIdx => {
     line(0,rowIdx,width,rowIdx)
  })
  translate(10,0)
  Anorm.forEach(([ops,t]) => {
    ops.forEach(([i,j]) => {
      push()
      line(t,i,t,j)
      fill('black')
      circle(t,j,4)
      circle(t,i,4)
      pop()
    })
  })
  state.forEach((val,idx) => {
    push()
    const circSize = idx=>sqrt((idx+1)*20)
    circle(frameCount*CEOAScale/rate,idx*CEOAScale,circSize(val))
    pop()
  })
}
