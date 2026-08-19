#!/usr/bin/env bash
set -Eeuo pipefail

# digico-ci-entrypoint requires GNU `timeout` (present on the production server
# and on GitHub Actions' Linux runners). macOS ships none by default; install
# coreutils and put `gtimeout` on PATH as `timeout` to run this suite locally.
readonly script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly entrypoint="${script_dir}/digico-ci-entrypoint"

pass_count=0
fail_count=0

log_fail() {
  printf 'FAIL: %s\n' "$1" >&2
  fail_count=$((fail_count + 1))
}

log_pass() {
  pass_count=$((pass_count + 1))
}

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [[ "${expected}" == "${actual}" ]]; then
    log_pass
  else
    log_fail "${desc}: expected [${expected}], got [${actual}]"
  fi
}

assert_contains() {
  local desc="$1" haystack="$2" needle="$3"
  if [[ "${haystack}" == *"${needle}"* ]]; then
    log_pass
  else
    log_fail "${desc}: expected output to contain [${needle}], got [${haystack}]"
  fi
}

# Builds a bare "origin" repo plus a working checkout tracking it, both under a
# fresh temp dir. Echoes the checkout path. $1: .env.example content to commit.
make_fixture() {
  local content="$1"
  local root
  root=$(mktemp -d)
  local origin="${root}/origin.git"
  local checkout="${root}/checkout"

  git init --quiet --bare "${origin}"
  git init --quiet "${checkout}"
  git -C "${checkout}" config user.email 'test@example.com'
  git -C "${checkout}" config user.name 'Test'
  printf '%s' "${content}" > "${checkout}/.env.example"
  git -C "${checkout}" add .env.example
  git -C "${checkout}" commit --quiet -m 'seed'
  git -C "${checkout}" branch -M main
  git -C "${checkout}" remote add origin "${origin}"
  git -C "${checkout}" push --quiet -u origin main

  printf '%s' "${checkout}"
}

# Advances the fixture's origin (not the local checkout) to a new .env.example,
# simulating "a PR merged to main after this checkout last synced". $1: checkout
# path, used to derive origin's path (a sibling "origin.git" per make_fixture's
# layout). $2: new .env.example content.
advance_origin() {
  local checkout="$1" content="$2"
  local origin
  origin="$(dirname "${checkout}")/origin.git"
  local scratch
  scratch=$(mktemp -d)
  git clone --quiet "${origin}" "${scratch}/clone"
  printf '%s' "${content}" > "${scratch}/clone/.env.example"
  git -C "${scratch}/clone" config user.email 'test@example.com'
  git -C "${scratch}/clone" config user.name 'Test'
  git -C "${scratch}/clone" add .env.example
  git -C "${scratch}/clone" commit --quiet -m 'advance'
  git -C "${scratch}/clone" push --quiet origin main
  rm -rf "${scratch}"
}

readonly example_basic=$'PORT=8787\nNODE_ENV=production\n# ELEVENLABS_STT_MODEL=scribe_v2\nDEEPSEEK_API_KEY=\nWHATSAPP_ACCESS_TOKEN=\n'

test_rejects_ssh_original_command() {
  local checkout
  checkout=$(make_fixture "${example_basic}")
  local out code
  out=$(DIGICO_PROJECT_DIR="${checkout}" SSH_ORIGINAL_COMMAND='rm -rf /' "${entrypoint}" </dev/null 2>&1) && code=0 || code=$?
  assert_eq 'SSH_ORIGINAL_COMMAND: exit code' 126 "${code}"
  assert_contains 'SSH_ORIGINAL_COMMAND: message' "${out}" 'direct SSH commands are not permitted'
  rm -rf "$(dirname "${checkout}")"
}

test_empty_payload_leaves_env_untouched_and_skips_git_sync() {
  local checkout
  checkout=$(make_fixture "${example_basic}")
  printf 'PORT=1234\n' > "${checkout}/.env"
  chmod 600 "${checkout}/.env"
  local before_head
  before_head=$(git -C "${checkout}" rev-parse HEAD)

  advance_origin "${checkout}" "${example_basic}FOO_KEY=\n"

  DIGICO_PROJECT_DIR="${checkout}" "${entrypoint}" </dev/null >/dev/null 2>&1 || true

  assert_eq 'empty payload: .env untouched' 'PORT=1234' "$(cat "${checkout}/.env")"
  assert_eq 'empty payload: git sync skipped' "${before_head}" "$(git -C "${checkout}" rev-parse HEAD)"
  rm -rf "$(dirname "${checkout}")"
}

test_whitespace_only_payload_leaves_env_untouched() {
  local checkout
  checkout=$(make_fixture "${example_basic}")
  printf 'PORT=1234\n' > "${checkout}/.env"

  DIGICO_PROJECT_DIR="${checkout}" "${entrypoint}" <<< '   ' >/dev/null 2>&1 || true

  assert_eq 'whitespace payload: .env untouched' 'PORT=1234' "$(cat "${checkout}/.env")"
  rm -rf "$(dirname "${checkout}")"
}

test_valid_payload_is_written_with_correct_perms() {
  local checkout
  checkout=$(make_fixture "${example_basic}")

  DIGICO_PROJECT_DIR="${checkout}" "${entrypoint}" <<< $'PORT=9999\nDEEPSEEK_API_KEY=sk-test\n' >/dev/null 2>&1 || true

  assert_eq 'valid payload: .env content' $'PORT=9999\nDEEPSEEK_API_KEY=sk-test' "$(cat "${checkout}/.env")"
  local perms
  perms=$(stat -f '%Lp' "${checkout}/.env" 2>/dev/null || stat -c '%a' "${checkout}/.env")
  assert_eq 'valid payload: .env perms' '600' "${perms}"
  rm -rf "$(dirname "${checkout}")"
}

test_unknown_key_rejects_whole_payload() {
  local checkout
  checkout=$(make_fixture "${example_basic}")
  printf 'PORT=1234\n' > "${checkout}/.env"

  local out code
  out=$(DIGICO_PROJECT_DIR="${checkout}" "${entrypoint}" <<< $'PORT=9999\nBADKEY=x\n' 2>&1) && code=0 || code=$?

  assert_eq 'unknown key: exit code' 65 "${code}"
  assert_contains 'unknown key: message' "${out}" 'rejected environment line (key not allowed): BADKEY'
  assert_eq 'unknown key: .env untouched' 'PORT=1234' "$(cat "${checkout}/.env")"
  rm -rf "$(dirname "${checkout}")"
}

test_malformed_line_rejects_whole_payload() {
  local checkout
  checkout=$(make_fixture "${example_basic}")

  local out code
  out=$(DIGICO_PROJECT_DIR="${checkout}" "${entrypoint}" <<< $'PORT=9999\nnotakeyvalue\n' 2>&1) && code=0 || code=$?

  assert_eq 'malformed line: exit code' 65 "${code}"
  assert_contains 'malformed line: message' "${out}" 'rejected malformed environment line'
  rm -rf "$(dirname "${checkout}")"
}

test_oversized_payload_does_not_hang_and_is_rejected() {
  local checkout
  checkout=$(make_fixture "${example_basic}")

  local out code
  out=$(head -c 70000 /dev/zero | tr '\0' 'A' | DIGICO_PROJECT_DIR="${checkout}" "${entrypoint}" 2>&1) && code=0 || code=$?

  assert_eq 'oversized payload: exit code' 65 "${code}"
  rm -rf "$(dirname "${checkout}")"
}

test_missing_env_example_is_refused() {
  local checkout
  checkout=$(make_fixture "${example_basic}")
  rm "${checkout}/.env.example"
  git -C "${checkout}" add -A
  git -C "${checkout}" commit --quiet -m 'remove example'
  git -C "${checkout}" push --quiet origin main

  local out code
  out=$(DIGICO_PROJECT_DIR="${checkout}" "${entrypoint}" <<< 'PORT=9999' 2>&1) && code=0 || code=$?

  assert_eq 'missing .env.example: exit code' 70 "${code}"
  assert_contains 'missing .env.example: message' "${out}" 'missing'
  rm -rf "$(dirname "${checkout}")"
}

test_allowlist_reflects_freshly_fetched_env_example() {
  local checkout
  checkout=$(make_fixture "${example_basic}")
  # origin gains FOO_KEY after this checkout's last sync — the whole point of
  # reordering git-sync before validation is that this key is now recognized.
  advance_origin "${checkout}" "${example_basic}FOO_KEY=\n"

  local out
  out=$(DIGICO_PROJECT_DIR="${checkout}" "${entrypoint}" <<< $'PORT=9999\nFOO_KEY=bar\n' 2>&1) || true

  assert_eq 'fresh allowlist: FOO_KEY not rejected' '' "$(printf '%s' "${out}" | grep -o 'rejected.*' || true)"
  assert_eq 'fresh allowlist: .env content' $'PORT=9999\nFOO_KEY=bar' "$(cat "${checkout}/.env" 2>/dev/null)"
  rm -rf "$(dirname "${checkout}")"
}

for t in test_rejects_ssh_original_command \
         test_empty_payload_leaves_env_untouched_and_skips_git_sync \
         test_whitespace_only_payload_leaves_env_untouched \
         test_valid_payload_is_written_with_correct_perms \
         test_unknown_key_rejects_whole_payload \
         test_malformed_line_rejects_whole_payload \
         test_oversized_payload_does_not_hang_and_is_rejected \
         test_missing_env_example_is_refused \
         test_allowlist_reflects_freshly_fetched_env_example; do
  "${t}"
done

printf '\n%d passed, %d failed\n' "${pass_count}" "${fail_count}"
[[ "${fail_count}" -eq 0 ]]
