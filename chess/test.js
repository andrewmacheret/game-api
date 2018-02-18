'use strict'

const ChessSanParser = require('./chess-san-parser')
let x

console.log('huh...')
x = {state:{"reason":null,"winner":null,"gameOver":false,"message":"Black to move","fen":"rnbqkbnr/pppp1ppp/8/4p3/3PP3/8/PPP2PPP/RNBQKBNR b KQkq d4 0 2","moves":["e4","e5","d4"]}}
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'd5')))

console.log('Test bestmove format...')
x.state = ChessSanParser.getInitialGameState()
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'e2e4', 'bestmove')))
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'e7e5', 'bestmove')))

console.log('Test pawns...')
x.state = ChessSanParser.getInitialGameState()
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'e4')))
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'e5')))
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'd4')))
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'd5')))
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'c4')))
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'c5')))
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'dxe5')))

console.log('Test castle...')
x.state = ChessSanParser.getInitialGameState()
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'e4')))
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'e5')))
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'Bc4')))
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'Bc5')))
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'Nf3')))
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'Nc6')))
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'O-O')))

console.log('Test check...')
x.state = ChessSanParser.getInitialGameState()
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'd4')))
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'c6')))
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'c4')))
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'Qa5')))

console.log('Test checkmate...')
x.state = ChessSanParser.getInitialGameState()
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'f3')))
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'e6')))
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'g4')))
console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'Qh4')))

console.log('Test game already over...')
try {
  x = {state:{fen: '8/k7/8/8/8/8/8/K7 w - - 0 1'}}
  console.log(JSON.stringify(x.state = ChessSanParser.getNewGameState(x.state, 'f3')))
} catch (e) {
  console.log('Got expected error:', e.message)
}

console.log('TESTS PASS')
