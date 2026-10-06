#!/usr/bin/env bash
# توابع مشترک Cron. این فایل را source کنید؛ مستقیم اجرا نمی‌شود.
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  echo "این فایل باید source شود، نه اجرا." >&2
  exit 1
fi

cron_project_root() {
  local here
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "$here/../.." && pwd
}

cron_tehran_stamp() {
  TZ=Asia/Tehran date '+%Y-%m-%d %H:%M:%S'
}

cron_tehran_day() {
  TZ=Asia/Tehran date '+%Y-%m-%d'
}

cron_fail() {
  local log="$1"
  local message="$2"
  mkdir -p "$(dirname "$log")"
  printf '%s\n' "--- شکست $(cron_tehran_stamp) تهران ---" "$message" "--- پایان $(cron_tehran_stamp) تهران کد خروج 1 ---" >>"$log"
  printf '%s\n' "$message" >&2
  exit 1
}

# NODE_BIN در .cron.env، سپس node در PATH، سپس جدیدترین /www/server/nodejs/*/bin/node
cron_resolve_node() {
  if [[ -n "${NODE_BIN:-}" ]]; then
    if [[ -x "$NODE_BIN" ]]; then
      printf '%s\n' "$NODE_BIN"
      return 0
    fi
    echo "NODE_BIN تنظیم شده اما فایل اجرایی نیست: $NODE_BIN" >&2
    return 1
  fi

  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi

  local candidate latest=""
  shopt -s nullglob
  for candidate in /www/server/nodejs/*/bin/node; do
    [[ -x "$candidate" ]] || continue
    if [[ -z "$latest" ]] || [[ "$(printf '%s\n%s\n' "$latest" "$candidate" | sort -V | tail -n 1)" == "$candidate" ]]; then
      latest="$candidate"
    fi
  done
  shopt -u nullglob

  if [[ -n "$latest" ]]; then
    printf '%s\n' "$latest"
    return 0
  fi

  echo "node پیدا نشد. NODE_BIN را در .cron.env بگذارید، node را در PATH قرار دهید، یا Node را زیر /www/server/nodejs نصب کنید." >&2
  return 1
}

cron_prune_logs() {
  local dir="$1"
  local days="${LOG_RETENTION_DAYS:-30}"
  if ! [[ "$days" =~ ^[0-9]+$ ]]; then
    days=30
  fi
  find "$dir" -maxdepth 1 -type f -name '*.log' -mtime +"$days" -delete
}

# cron_main <job-name> <script-relative-to-project>
cron_main() {
  local job="$1"
  local relative_script="$2"
  local root env_file node tsx script log lock code

  root="$(cron_project_root)"
  env_file="$root/.cron.env"
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi

  if [[ -z "${LOG_DIR:-}" ]]; then
    LOG_DIR="$root/logs"
  elif [[ "$LOG_DIR" != /* ]]; then
    LOG_DIR="$root/$LOG_DIR"
  fi
  mkdir -p "$LOG_DIR"

  log="$LOG_DIR/${job}-$(cron_tehran_day).log"
  lock="$LOG_DIR/${job}.lock"
  exec 9>"$lock"
  if ! flock -n 9; then
    cron_fail "$log" "اجرای هم‌زمان ${job} در جریان است؛ این نوبت رد شد."
  fi

  if ! node="$(cron_resolve_node 2>>"$log")"; then
    cron_fail "$log" "node پیدا نشد. NODE_BIN را در .cron.env تنظیم کنید."
  fi

  tsx="$root/node_modules/tsx/dist/cli.mjs"
  script="$root/$relative_script"
  if [[ ! -f "$tsx" ]]; then
    cron_fail "$log" "tsx پیدا نشد: $tsx — در ریشه پروژه npm ci را اجرا کنید."
  fi
  if [[ ! -f "$script" ]]; then
    cron_fail "$log" "اسکریپت پیدا نشد: $script"
  fi

  {
    printf '%s\n' "--- شروع ${job} $(cron_tehran_stamp) تهران ---"
    printf '%s\n' "node: $node"
    printf '%s\n' "script: $script"
  } >>"$log"

  set +e
  (
    cd "$root"
    export PATH="$(dirname "$node"):$PATH"
    "$node" "$tsx" "$script"
  ) >>"$log" 2>&1
  code=$?
  set -e

  printf '%s\n' "--- پایان ${job} $(cron_tehran_stamp) تهران کد خروج ${code} ---" >>"$log"
  cron_prune_logs "$LOG_DIR"
  exit "$code"
}
