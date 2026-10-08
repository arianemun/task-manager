#!/usr/bin/env bash
# کپی افزایشی BACKUP_DIR به یک سرور دیگر با rsync روی SSH.
# تا OFFSITE_BACKUP_TARGET در .cron.env خالی باشد کاری نمی‌کند.
# install.sh این کار را به crontab اضافه نمی‌کند.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$here/_common.sh"

root="$(cron_project_root)"
if [[ -f "$root/.cron.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$root/.cron.env"
  set +a
fi

if [[ -z "${OFFSITE_BACKUP_TARGET:-}" ]]; then
  echo "بکاپ خارج از سرور خاموش است. OFFSITE_BACKUP_TARGET را در .cron.env بگذارید."
  exit 0
fi

backup="${BACKUP_DIR:-$root/backups}"
if [[ "$backup" != /* ]]; then
  backup="$root/$backup"
fi
if [[ ! -d "$backup" ]]; then
  echo "پوشه بکاپ پیدا نشد: $backup" >&2
  exit 1
fi

rsync -a -e "ssh -o BatchMode=yes" "${backup}/" "${OFFSITE_BACKUP_TARGET}/"
