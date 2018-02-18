'use strict'

const AWS = require('aws-sdk')
const uuidv1 = require('uuid/v1')
const uuidValidate = require('uuid-validate')
const ChessSanParser = require('./chess/chess-san-parser')

class BadRequestError extends Error {
  constructor(str) {
    super(str)
    this.statusCode = 400
  }
}
class NotAuthorizedError extends Error {
  constructor(str) {
    super(str)
    this.statusCode = 401
  }
}
class NotFoundError extends Error {
  constructor(str) {
    super(str)
    this.statusCode = 404
  }
}
class InternalServerError extends Error {
  constructor(str) {
    super(str)
    this.statusCode = 500
  }
}

if (!process.env['GAME_API_KEYS']) {
  throw new Error('Environment variable GAME_API_KEYS must be defined')
}
const gameApiKeys = new Set(process.env['GAME_API_KEYS'].split(','))

AWS.config.update({
  region: 'us-east-1',
  endpoint: 'dynamodb.us-east-1.amazonaws.com'
})

const docClient = new AWS.DynamoDB.DocumentClient()

const respond = (callback, statusCode, responseBody) => {
  const response = {
    statusCode,
    headers: {},
    body: JSON.stringify(responseBody)
  }
  console.log('response: ' + JSON.stringify(response))
  callback(null, response)
}

const respondWithSuccess = (callback, responseBody) => {
  respond(callback, 200, responseBody)
}

const respondWithError = (callback, error) => {
  console.log(error.statusCode, error)
  respond(callback, error.statusCode || 500, {error: error.message || error})
}

const dynamo = (method, params) => {
  console.log(`Performing docClient.${method} with params: `, JSON.stringify(params))
  return new Promise((resolve, reject) => {
    docClient[method](params, function(error, data) {
      if (error) {
        console.error('Request failed. Error JSON:', JSON.stringify(error))
        reject(error)
        return
      }

      console.error('Request succeeded. Data JSON:', JSON.stringify(data))
      resolve(data)
    })
  })
}

const safeForDynamo = (str) => {
  return str !== '' ? str : null
}

const getGameId = (event) => {
  const game_id = event.pathParameters['game_id']
  if (!uuidValidate(game_id, 1)) {
    throw new BadRequestError(`game_id is not a valid uuid v1, game_id='${game_id}'`)
  }
  return game_id
}

const getGameRules = (event) => {
  return safeForDynamo(('' + (event.queryStringParameters.rules || 'chess')).substring(0, 100))
}

const getPlayerNumber = (event, maxNumberOfPlayers=2) => { // TODO: support more than 2 players?
  const player_number = parseInt(event.pathParameters['player_number'])
  if (!(!isNaN(player_number) && 0 <= player_number && player_number < maxNumberOfPlayers)) {
    throw new BadRequestError(`player_number is not a valid integer between 0 and ${maxNumberOfPlayers - 1} inclusive, player_number='${player_number}'`)
  }
  return player_number
}

const getPlayerContact = (event) => {
  return event.queryStringParameters.contact ? safeForDynamo(('' + (event.queryStringParameters.contact || '')).substring(0, 254)) : null
}

const getPlayerAccepted = (event) => {
  return event.queryStringParameters.accepted ? new Date().toISOString() : null
}

const getStateVersion = (event, ...keywords) => {
  let version = event.pathParameters['version']
  if (keywords.indexOf(version) >= 0) {
    return version
  }
  version = parseInt(event.pathParameters['version'])
  if (!(!isNaN(version) && 0 <= version)) {
    throw new BadRequestError(`version is not a valid non-negative integer, version='${version}'`)
  }
  return version
}

const getStateMove = (event) => {
  const move = event.queryStringParameters['move']
  if (!move) {
    throw new BadRequestError(`move is not specified, move='${move}'`)
  }
  return move
}

const getStateMoveFormat = (event) => {
  return event.queryStringParameters['format'] || 'san'
}

const getCreator = (event) => {
  return event.requestContext.identity || {}
}

const getCreated = () => {
  return new Date().toISOString()
}

const notImplemented = (event, callback, context) => {
  throw new NotFoundError('Not Implemented')
}

exports.handler = (event, context, callback) => {
  const startedAt = Date.now()
  const timedCallback = (error, response) => {
    if (response && response.body) {
      const responseBody = JSON.parse(response.body)
      responseBody.millis = Date.now() - startedAt
      console.log('millis=', responseBody.millis)
      response.body = JSON.stringify(responseBody)
    }
    callback(error, response)
  }

  try {
    console.log('event=', JSON.stringify(event))
    if (!event.pathParameters) event.pathParameters = {}
    if (!event.queryStringParameters) event.queryStringParameters = {}
    if (!event.requestContext) event.requestContext = {}
    if (!event.headers) event.headers = {}

    const gameApiKey = event.headers['X-GameApiKey'] || event.headers['X-GameApiKey'.toLowerCase()]
    console.log('Expected gameApiKeys=', gameApiKeys)
    console.log('Actual gameApiKey=', gameApiKey)
    if (!gameApiKeys.has(gameApiKey)) {
      throw new NotAuthorizedError(`Not authorized`)
    }

    const handler = ((apis[event.resource] || {})[event.httpMethod] || notImplemented)
    handler(event, timedCallback, context)
  } catch (error) {
    respondWithError(timedCallback, error)
  }
}

const apis = {}



///////////////////////////////////////////////////////////
// GAMES
///////////////////////////////////////////////////////////



apis['/games'] = {}
apis['/games/{game_id}'] = {}

const initialGameState = (rules) => {
  if (rules == 'chess') {
    return ChessSanParser.getInitialGameState()
  }

  throw new BadRequestError(`Rule set '${rules}' not supported. Only 'chess' is currently supported.`)
}

const newGameState = (rules, lastState, move, moveFormat) => {
  if (rules == 'chess') {
    return ChessSanParser.getNewGameState(lastState, move, moveFormat)
  }

  throw new BadRequestError(`Rule set '${rules}' not supported. Only 'chess' is currently supported.`)
}

apis['/games/{game_id}']['GET'] = (event, callback) => {
  const game_id = getGameId(event)

  const getGameRequest = {
    TableName: 'game',
    Key: { game_id },
    ExpressionAttributeNames: {'#gi': 'game_id', '#r': 'rules', '#c': 'created'},
    ProjectionExpression: '#gi, #r, #c'
  }

  const queryGameStateRequest = {
    TableName: 'game_state',
    KeyConditionExpression: 'game_id = :game_id',
    ExpressionAttributeValues: { ':game_id': game_id },
    ExpressionAttributeNames: {'#s': 'state', '#e': 'event', '#v': 'version', '#c': 'created'},
    ProjectionExpression: '#s, #e, #v, #c',
    ScanIndexForward: false
  }

  const queryGamePlayersRequest = {
    TableName: 'game_players',
    KeyConditionExpression: 'game_id = :game_id',
    ExpressionAttributeValues: { ':game_id': game_id },
    ExpressionAttributeNames: {'#e': 'contact', '#h': 'is_human', '#a': 'accepted', '#c': 'created'},
    ProjectionExpression: '#e, #h, #a, #c'
  }

  const queryGameWatchersRequest = {
    TableName: 'game_watchers',
    KeyConditionExpression: 'game_id = :game_id',
    ExpressionAttributeValues: { ':game_id': game_id },
    ExpressionAttributeNames: {'#u': 'url', '#c': 'created'},
    ProjectionExpression: '#u, #c'
  }

  Promise.all([
    dynamo('get', getGameRequest),
    dynamo('query', queryGameStateRequest),
    dynamo('query', queryGamePlayersRequest),
    dynamo('query', queryGameWatchersRequest)
  ]).then((data) => {
    const game = data[0].Item
    const game_states = data[1].Items
    const game_players = data[2].Items
    const game_watchers = data[3].Items
    game.game_states = game_states
    game.game_players = game_players
    game.game_watchers = game_watchers
    respondWithSuccess(callback, {game})
  }).catch((error) => {
    respondWithError(callback, error)
  })
}

apis['/games']['POST'] = (event, callback) => {
  const game = {
    game_id: uuidv1(),
    creator: getCreator(event),
    created: getCreated(),
    rules: getGameRules(event)
  }

  const game_state = {
    game_id: game.game_id,
    rules: game.rules,
    state: initialGameState(game.rules),
    event: {action: 'create_game'},
    version: 0,
    creator: game.creator,
    created: game.created
  }

  const game_players = [0,1].map(i => ({ // TODO: support games with more than 2 players
    game_id: game.game_id,
    player_number: i,
    is_human: true, // TODO: support AIs
    contact: null,
    creator: game.creator,
    created: game.created
  }))

  const game_watchers = []

  const batchWriteRequest = {
    RequestItems: {
      game: [
        {
          PutRequest: {
            Item: game
          }
        }
      ],
      game_state: [
        {
          PutRequest: {
            Item: game_state
          }
        }
      ],
      game_players: game_players.map(game_player => ({
        PutRequest: {
          Item: game_player
        }
      }))
    }
  }

  dynamo('batchWrite', batchWriteRequest).then((data) => {
    delete game.creator
    delete game_state.game_id
    delete game_state.creator
    delete game_state.rules
    
    game_players.forEach(game_player => {
      delete game_player.game_id
      delete game_player.player_number
      delete game_player.creator
    })

    game.game_states = [game_state]
    game.game_players = game_players
    game.game_watchers = game_watchers

    respondWithSuccess(callback, {game})
  }).catch((error) => {
    respondWithError(callback, error)
  })
}



///////////////////////////////////////////////////////////
// PLAYERS
///////////////////////////////////////////////////////////


apis['/games/{game_id}/players'] = {}
apis['/games/{game_id}/players/{player_number}'] = {}

apis['/games/{game_id}/players']['GET'] = (event, callback) => {
  const game_id = getGameId(event)

  const queryGamePlayersRequest = {
    TableName: 'game_players',
    KeyConditionExpression: 'game_id = :game_id',
    ExpressionAttributeValues: { ':game_id': game_id },
    ExpressionAttributeNames: {'#e': 'contact', '#h': 'is_human', '#a': 'accepted', '#c': 'created'},
    ProjectionExpression: '#e, #h, #a, #c'
  }

  dynamo('query', queryGamePlayersRequest).then((data) => {
    const game_players = data.Items
    respondWithSuccess(callback, {game_players})
  }).catch((error) => {
    respondWithError(callback, error)
  })
}

apis['/games/{game_id}/players/{player_number}']['GET'] = (event, callback) => {
  const game_id = getGameId(event)
  const player_number = getPlayerNumber(event)

  const getGamePlayerRequest = {
    TableName: 'game_players',
    Key: { game_id, player_number },
    ExpressionAttributeNames: {'#e': 'contact', '#h': 'is_human', '#a': 'accepted', '#c': 'created'},
    ProjectionExpression: '#e, #h, #a, #c'
  }

  dynamo('get', getGamePlayerRequest).then((data) => {
    const game_player = data.Item
    respondWithSuccess(callback, {game_player})
  }).catch((error) => {
    respondWithError(callback, error)
  })
}

apis['/games/{game_id}/players/{player_number}']['PUT'] = (event, callback) => {
  const player_number = getPlayerNumber(event)
  const game_player = {
    game_id: getGameId(event),
    player_number,
    contact: getPlayerContact(event),
    is_human: true, // TODO: support AIs
    accepted: getPlayerAccepted(event),
    creator: getCreator(event),
    created: getCreated()
  }

  const expressionSets = [
    'creator = if_not_exists(creator, :creator)',
    'created = if_not_exists(created, :created)'
  ]
  const expressionValues = {
    ':creator': game_player.creator,
    ':created': game_player.created
  }
  ;['contact', 'accepted', 'is_human'].forEach(attribute => {
    if (game_player[attribute]) {
      expressionSets.push(`${attribute} = :${attribute}`)
      expressionValues[`:${attribute}`] = game_player[attribute]
    }
  })

  const updateGamePlayerRequest = {
    TableName: 'game_players',
    Key: {
      game_id: game_player.game_id,
      player_number: game_player.player_number
    },
    UpdateExpression: 'SET ' + expressionSets.join(', '),
    ExpressionAttributeValues: expressionValues,
    ReturnValues: 'ALL_NEW'
  }


  dynamo('update', updateGamePlayerRequest).then((data) => {
    const game_player = data.Attributes
    
    delete game_player.game_id
    delete game_player.player_number
    delete game_player.creator
    
    respondWithSuccess(callback, {game_player})
  }).catch((error) => {
    respondWithError(callback, error)
  })
}



///////////////////////////////////////////////////////////
// STATES
///////////////////////////////////////////////////////////



apis['/games/{game_id}/states'] = {}
apis['/games/{game_id}/states/{version}'] = {}

// get all the game states
apis['/games/{game_id}/states']['GET'] = (event, callback) => {
  const game_id = getGameId(event)

  const queryGameStateRequest = {
    TableName: 'game_state',
    KeyConditionExpression: 'game_id = :game_id',
    ExpressionAttributeValues: { ':game_id': game_id },
    ExpressionAttributeNames: {'#s': 'state', '#e': 'event', '#v': 'version', '#c': 'created'},
    ProjectionExpression: '#s, #e, #v, #c',
    ScanIndexForward: false
  }

  dynamo('query', queryGameStateRequest).then((data) => {
    const game_states = data.Items
    respondWithSuccess(callback, {game_states})
  }).catch((error) => {
    respondWithError(callback, error)
  })
}

// get a specific game state
apis['/games/{game_id}/states/{version}']['GET'] = (event, callback) => {
  const game_id = getGameId(event)
  const version = getStateVersion(event, '_latest')

  // version == _latest: returns the latest game state
  // otherwise query for a specific one
  if (version === '_latest') {
    const queryGameStateRequest = {
      TableName: 'game_state',
      KeyConditionExpression: 'game_id = :game_id',
      ExpressionAttributeValues: { ':game_id': game_id },
      ExpressionAttributeNames: {'#s': 'state', '#e': 'event', '#v': 'version', '#c': 'created'},
      ProjectionExpression: '#s, #e, #v, #c',
      ScanIndexForward: false,
      Limit: 1
    }

    dynamo('query', queryGameStateRequest).then((data) => {
      const game_state = data.Items.length > 0 ? data.Items[0] : {}
      respondWithSuccess(callback, {game_state})
    }).catch((error) => {
      respondWithError(callback, error)
    })
  } else {
    const getGameStateRequest = {
      TableName: 'game_state',
      Key: { game_id, version },
      ExpressionAttributeNames: {'#s': 'state', '#e': 'event', '#v': 'version', '#c': 'created'},
      ProjectionExpression: '#s, #e, #v, #c'
    }

    dynamo('get', getGameStateRequest).then((data) => {
      const game_state = data.Item
      respondWithSuccess(callback, {game_state})
    }).catch((error) => {
      respondWithError(callback, error)
    })
  }
}


// add a new game state... currently only making a move is allowed
apis['/games/{game_id}/states/{version}']['PUT'] = (event, callback) => {
  const game_id = getGameId(event)
  const version = getStateVersion(event)
  const move = getStateMove(event)
  const moveFormat = getStateMoveFormat(event)
  console.log('moveFormat=', moveFormat)
  const creator = getCreator(event)

  const queryGameStateRequest = {
    TableName: 'game_state',
    KeyConditionExpression: 'game_id = :game_id',
    ExpressionAttributeValues: { ':game_id': game_id },
    ExpressionAttributeNames: {'#s': 'state', '#r': 'rules', '#v': 'version'},
    ProjectionExpression: '#s, #r, #v',
    ScanIndexForward: false,
    Limit: 1
  }

  dynamo('query', queryGameStateRequest).then((data) => {
    if (data.Items.length === 0) {
      throw new InternalServerError(`No game state associated with game: ${game_id}`)
    }
    const latest_game_state = data.Items[0]

    if (latest_game_state.version !== version - 1) {
      throw new BadRequestError(`requested version should be 1 greater than latest version. requested='${version}', latest='${latest_game_state.version}'`)
    }

    const state = newGameState(latest_game_state.rules, latest_game_state.state, move, moveFormat)

    const game_state = {
      game_id,
      state,
      rules: latest_game_state.rules,
      event: {action: 'move', move},
      version,
      creator,
      created: getCreated()
    }

    const putGameStateRequest = {
      TableName : 'game_state',
      Item: game_state,
      ConditionExpression: 'attribute_not_exists(version)'
    }

    dynamo('put', putGameStateRequest).then((data) => {
      delete game_state.game_id
      delete game_state.creator
      delete game_state.rules

      respondWithSuccess(callback, {game_state})
    }).catch((error) => {
      respondWithError(callback, error)
    })
  }).catch((error) => {
    respondWithError(callback, error)
  })
}


///////////////////////////////////////////////////////////
// WATCHERS
///////////////////////////////////////////////////////////



apis['/games/{game_id}/watchers'] = {}
apis['/games/{game_id}/watchers/{watcher_id}'] = {}


