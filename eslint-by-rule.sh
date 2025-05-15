#!/bin/bash

# Usage: ./eslint-rule.sh <rule-name> [directory-or-file]

RULE="$1"
TARGET="${2:-.}" # Default to current directory if not provided

if [ -z "$RULE" ]; then
  echo "Usage: $0 <eslint-rule-name> [directory-or-file]"
  exit 1
fi

# Run eslint with JSON output, then filter using jq (you need jq installed)
npx eslint "$TARGET" -f json | jq -r \
  --arg rule "$RULE" \
  '.[] | select(.messages != null) | .filePath as $file | .messages[] | select(.ruleId == $rule) | "\($file):\(.line):\(.column) \(.message) [\(.ruleId)]"'
