#!/usr/bin/env bash
# بکاپ افزایشی هفتگی رسانهٔ چت. مستقیم از Cron صدا زده می‌شود.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$here/_common.sh"
cron_main "chat-media-backup" "scripts/chat-media-backup.ts"
