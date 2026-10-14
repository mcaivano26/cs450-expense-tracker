#!/usr/bin/env bash
# Tests the Zod schema on POST /api/transactions (backend/src/schemas/transaction.ts) with curl.
# Start the backend first:  npm --prefix backend run dev
# Then run:                 bash backend/scripts/zod-curl-tests.sh
BASE="${BASE:-http://localhost:4002}"
URL="$BASE/api/transactions"
pass=0; fail=0

run() {
  local name="$1" expected="$2" body="$3"
  local out status
  out=$(curl -s -w '\n%{http_code}' -X POST "$URL" -H 'Content-Type: application/json' -d "$body")
  status=$(printf '%s' "$out" | tail -n 1)
  out=$(printf '%s' "$out" | sed '$d')
  if [ "$status" = "$expected" ]; then
    pass=$((pass + 1)); echo "PASS  [$status] $name"
  else
    fail=$((fail + 1)); echo "FAIL  [$status, expected $expected] $name"
  fi
  echo "      request:  $body"
  echo "      response: $out"
  echo
}

if ! curl -s -o /dev/null "$BASE/api/health"; then
  echo "Backend is not running at $BASE. Start it with: npm --prefix backend run dev"; exit 1
fi

echo "== Valid requests (expect 201) =="
run "valid expense"                    201 '{"title":"Coffee","amount":4.5,"category":"Food","type":"expense","date":"2026-10-13T12:00:00Z"}'
run "valid income"                     201 '{"title":"Paycheck","amount":1200,"category":"Salary","type":"income","date":"2026-10-13T12:00:00Z"}'
run "type and date are optional"       201 '{"title":"Snack","amount":2,"category":"Food"}'
run "title gets trimmed"               201 '{"title":"   Bus pass   ","amount":25,"category":"Transport"}'

echo "== Invalid requests (expect 400 with field errors) =="
run "missing title"                    400 '{"amount":4.5,"category":"Food"}'
run "empty title"                      400 '{"title":"","amount":4.5,"category":"Food"}'
run "title over 100 characters"        400 "{\"title\":\"$(printf 'a%.0s' $(seq 1 101))\",\"amount\":4.5,\"category\":\"Food\"}"
run "negative amount"                  400 '{"title":"Coffee","amount":-5,"category":"Food"}'
run "amount is zero"                   400 '{"title":"Coffee","amount":0,"category":"Food"}'
run "amount sent as text"              400 '{"title":"Coffee","amount":"4.50","category":"Food"}'
run "amount over 1,000,000"            400 '{"title":"Car","amount":1000001,"category":"Transport"}'
run "missing category"                 400 '{"title":"Coffee","amount":4.5}'
run "type not expense or income"       400 '{"title":"Coffee","amount":4.5,"category":"Food","type":"refund"}'
run "date not a full date-time"        400 '{"title":"Coffee","amount":4.5,"category":"Food","date":"10/13/2026"}'
run "several problems at once"         400 '{"title":"","amount":-1}'

echo "== Result: $pass passed, $fail failed =="
[ "$fail" -eq 0 ]
