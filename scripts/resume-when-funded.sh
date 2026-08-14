#!/usr/bin/env bash
# Wait for the Anthropic account to have credit again, then run the rest of the
# batch. Written because a batch died mid-run on an empty balance and there is
# no point a human babysitting the top-up.
#
#   scripts/resume-when-funded.sh <end-epoch-seconds> <key> [key ...]
#
# Probes with a one-token request every two minutes. While the balance is empty
# that request is rejected before any tokens are charged, so polling is free.
set -u
cd "$(dirname "$0")/.."

END=$1
shift
KEYS=("$@")

# Read the key out of .env without printing it.
KEYLINE=$(grep -m1 '^ANTHROPIC_API_KEY=' .env | cut -d= -f2- | tr -d '"'"'"' \r')
if [ -z "$KEYLINE" ]; then
  echo "no ANTHROPIC_API_KEY in .env, cannot probe"
  exit 1
fi

echo "waiting for credit, then publishing: ${KEYS[*]}"

while true; do
  body=$(curl -s --max-time 30 https://api.anthropic.com/v1/messages \
    -H "x-api-key: $KEYLINE" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d '{"model":"claude-haiku-4-5-20251001","max_tokens":1,"messages":[{"role":"user","content":"."}]}' 2>/dev/null || true)

  # The expected case while waiting. Matched as a bare substring: the phrase sits
  # mid-sentence in the JSON message, so a pattern with quotes round it never
  # matches and every probe falls through to the noisy branch below.
  if printf '%s' "$body" | grep -q 'credit balance is too low'; then
    sleep 120
    continue
  fi

  if printf '%s' "$body" | grep -q '"type":"error"'; then
    # Some other error (rate limit, network). Keep waiting rather than starting a
    # run that would fail article by article. Reported once per distinct error so
    # a persistent fault is visible without repeating every two minutes.
    msg=$(printf '%s' "$body" | head -c 160)
    if [ "${msg}" != "${last_msg:-}" ]; then
      echo "probe error, still waiting: $msg"
      last_msg="$msg"
    fi
    sleep 120
    continue
  fi

  echo "=== credit available at $(date '+%H:%M:%S'), resuming ${#KEYS[@]} articles"
  exec bash scripts/paced-batch.sh "$END" "${KEYS[@]}"
done
