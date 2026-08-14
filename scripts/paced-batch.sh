#!/usr/bin/env bash
# Publish a list of batch-plan keys spread evenly across a window, rather than
# firing them all off back to back. Each key is written, gated and published by
# batch-publish.js; this only decides when the next one starts.
#
#   scripts/paced-batch.sh <end-epoch-seconds> <key> [key ...]
#
# Slots are computed from the wall clock, not from a fixed sleep, so an article
# that takes longer than expected eats into its own slack instead of pushing the
# whole run past the deadline. If the batch falls behind, the remaining articles
# simply run back to back.
set -u
cd "$(dirname "$0")/.."

END=$1
shift
KEYS=("$@")
N=${#KEYS[@]}
START=$(date +%s)

# One gap fewer than the number of articles: the first starts now, the last
# starts at the deadline.
if [ "$N" -gt 1 ]; then
  GAP=$(( (END - START) / (N - 1) ))
else
  GAP=0
fi
[ "$GAP" -lt 0 ] && GAP=0

echo "paced-batch: $N articles, first now, gap ${GAP}s, deadline $(date -d @"$END" '+%H:%M' 2>/dev/null || echo "$END")"

i=0
ok=0
fail=0
for key in "${KEYS[@]}"; do
  target=$(( START + i * GAP ))
  now=$(date +%s)
  if [ "$now" -lt "$target" ]; then
    wait_for=$(( target - now ))
    echo "--- waiting ${wait_for}s until slot $((i+1))/$N ($key)"
    sleep "$wait_for"
  fi

  echo "=== [$(date '+%H:%M:%S')] slot $((i+1))/$N: $key"
  if node scripts/batch-publish.js "$key"; then
    ok=$((ok+1))
  else
    # One failure must not take the rest of the run with it. batch-publish.js
    # records its own state, so a failed key can be retried on its own later.
    fail=$((fail+1))
    echo "!!! $key failed, continuing with the rest"
  fi
  i=$((i+1))
done

echo "=== paced-batch done at $(date '+%H:%M:%S'): $ok published, $fail failed"
