'use strict'

const ChessState = require('./chess-state')
const ChessMove = require('./chess-move')
const ChessRules = require('./chess-rules')

const FOREFEIT_MOVE = 'forfeit'
const BOARD_HEIGHT = 8

class ChessSanParser {
  getInitialGameState() {
    return this.processChessState(new ChessState())
  }

  getNewGameState(lastState, san, moveFormat='san') {
    console.log('lastState=', JSON.stringify(lastState))
    console.log('san=', san)

    if (!lastState.fen) {
      throw new Error(`lastState.fen is not specified: '${lastState.fen}'`)
    }

    const chessState = new ChessState({fen: lastState.fen})
    console.log('fen=', chessState.toFen())

    const gameStatus = ChessRules.getGameStatus(chessState)
    if (gameStatus.game_over) {
      throw new Error(`Game is already over: '${gameStatus.reason}'`)
    }
    console.log('# of legal moves:', gameStatus.legalMoves.length)

    let moves
    if (san === FOREFEIT_MOVE) {
      moves = [FOREFEIT_MOVE]
    } else if (moveFormat === 'san') {
      console.log('moveFormat is san')
      // do this the easy way for now...
      // TODO: we need to allow some leniency!
      moves = gameStatus.legalMoves.filter(move => {
        return move.toPGN().replace(/(\+|#|e.p.)$/, '') === san.replace(/(\+|#|e.p.)$/, '')
      })
    } else if (moveFormat === 'bestmove') {
      console.log('moveFormat is bestmove')
      const basicMove = this.convertToBasicMove(san)
      console.log('basicMove=', basicMove)
      moves = gameStatus.legalMoves.filter(move =>
        basicMove.source.rowNumber === move.source.rowNumber &&
        basicMove.source.columnNumber === move.source.columnNumber &&
        basicMove.target.rowNumber === move.target.rowNumber &&
        basicMove.target.columnNumber === move.target.columnNumber
      )
    } else {
      throw new Error(`Invalid move format: '${moveFormat}'`)
    }

    if (moves.length !== 1) {
      const validMoves = gameStatus.legalMoves.map(move => move.toPGN())
      validMoves.push(FOREFEIT_MOVE)
      throw new Error(`'${san}' is not a valid move. Valid moves: ${validMoves.join(', ')}`)
    }
    const move = moves[0]

    let lastMoves = lastState.moves || []

    if (move === FOREFEIT_MOVE) {
      const actualSan = chessState.getPlayer() === 'w' ? '0-1' : '1-0'
      console.log('actualSan=', actualSan)
      return this.processChessState(chessState, lastMoves.concat(actualSan), true)
    }

    const newChessState = ChessRules.performMove(chessState, move)

    return this.processChessState(newChessState, lastMoves.concat(move.toPGN()))
  }

  processChessState(chessState, moves=[], isForfeit=false) {
    const newFen = chessState.toFen()
    console.log('new_fen=', newFen)

    const state = !isForfeit ? ChessRules.getGameStatus(chessState) : {
      gameOver: true,
      reason: FOREFEIT_MOVE,
      message: (chessState.getPlayer() === 'w' ? 'White' : 'Black') + ' forfeits.',
      winner: (chessState.getPlayer() === 'w' ? 'b' : 'w')
    }
    console.log('game_over=', state.gameOver)

    const result = {
      fen: newFen,
      moves: moves,
      game_over: !!state.gameOver,
      reason: state.reason || null,
      message: state.message || null,
      winner: state.winner || null,
      next_players: state.gameOver ? [] : chessState.getPlayer() == 'w' ? [0] : [1],
    }
    console.log('result=', JSON.stringify(result))
    return result
  }

  convertToBasicMove(bestMove) {
    return {
      source: {
        columnNumber: this.getColumnNumber(bestMove[0]),
        rowNumber: this.getRowNumber(bestMove[1])
      },
      target: {
        columnNumber: this.getColumnNumber(bestMove[2]),
        rowNumber: this.getRowNumber(bestMove[3])
      }
    }
  }

  getRowNumber(row) {
    return BOARD_HEIGHT - (row.charCodeAt(0) - '1'.charCodeAt(0)) - 1;
  }

  getColumnNumber(column) {
    return column.charCodeAt(0) - 'a'.charCodeAt(0);
  }
}

module.exports = new ChessSanParser()
