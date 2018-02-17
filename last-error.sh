#!/usr/bin/env bash
set -e

aws logs get-log-events --log-group-name '/aws/lambda/GameApiResource' --log-stream-name "$(
    aws logs describe-log-streams --log-group-name /aws/lambda/GameApiResource |
      jq -r '.logStreams | sort_by(.lastEventTimestamp) | .[-1].logStreamName'
  )" | jq -r '.events[] | .message' 
