#!/usr/bin/env bash
set -e
set -x

source .env

# basic test ...

node index.js

node test-chess-san-parser.js

# upload to aws lambda ...

rm -f upload*.zip
zip -q -r "upload-$(date +%s).zip" .
UPLOAD_ZIP="$( ls upload*.zip )"

aws lambda update-function-code \
  --function-name "${LAMBDA_FUNCTION_NAME}" \
  --zip-file "fileb://${UPLOAD_ZIP}"

# test it...

call_api() {
  API_RESULT="$( curl -s -H "X-GameApiKey: ${GAME_API_KEYS}" -X"$1" "${GAME_ENDPOINT}$2" )"
  <<<"$API_RESULT" jq '.'
  if [[ $( <<<"$API_RESULT" jq -r '.error' ) != "null" ]]; then
    echo 'TESTS FAIL' 1>&2
    exit 1
  fi
}

call_api POST "/games"
GAME_ID="$( <<<"$API_RESULT" jq -r '.game.game_id' )"

call_api GET "/games/${GAME_ID}"

call_api PUT "/games/${GAME_ID}/players/0?contact=white@x.com"

call_api PUT "/games/${GAME_ID}/players/1?contact=black@x.com"

call_api GET "/games/${GAME_ID}/players/0"

call_api GET "/games/${GAME_ID}/players/1"

call_api GET "/games/${GAME_ID}/players"

call_api PUT "/games/${GAME_ID}/states/1?move=e4"

call_api PUT "/games/${GAME_ID}/states/2?move=e5"

call_api GET "/games/${GAME_ID}/states/_latest"

call_api GET "/games/${GAME_ID}/states"

call_api PUT "/games/${GAME_ID}/states/3?move=d4"

call_api PUT "/games/${GAME_ID}/states/4?move=d5"

call_api GET "/games/${GAME_ID}/states/_latest"

call_api GET "/games/${GAME_ID}/states/4"

echo 'PASS'
