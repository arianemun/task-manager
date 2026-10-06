#!/usr/bin/env bash
# بلوک Cron پروژه را در crontab کاربر www نصب یا جایگزین می‌کند.
# باید با root اجرا شود. تکرار اجرا همان بلوک را عوض می‌کند و بقیه خطوط را نگه می‌دارد.
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "install.sh باید با root اجرا شود." >&2
  exit 1
fi

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"
cron_user="${1:-www}"
begin="# BEGIN task-manager"
end="# END task-manager"

if ! id "$cron_user" >/dev/null 2>&1; then
  echo "کاربر crontab پیدا نشد: $cron_user" >&2
  exit 1
fi

block="$(cat <<EOF
${begin}
5 0 * * * bash ${root}/scripts/cron/generate.sh
15 0 * * * bash ${root}/scripts/cron/close-periods.sh
0 2 * * * bash ${root}/scripts/cron/backup.sh
25 2 * * * bash ${root}/scripts/cron/db-check.sh
${end}
EOF
)"

current="$(crontab -u "$cron_user" -l 2>/dev/null || true)"
cleaned="$(printf '%s\n' "$current" | awk -v begin="$begin" -v end="$end" '
  $0 == begin { skip = 1; next }
  $0 == end { skip = 0; next }
  skip { next }
  { print }
')"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
if [[ -n "${cleaned//[[:space:]]/}" ]]; then
  printf '%s\n\n' "$cleaned" >"$tmp"
fi
printf '%s\n' "$block" >>"$tmp"
crontab -u "$cron_user" "$tmp"
echo "crontab کاربر ${cron_user} به‌روز شد."
