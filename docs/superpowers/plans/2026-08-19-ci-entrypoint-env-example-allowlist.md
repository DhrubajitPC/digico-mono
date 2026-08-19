# CI Deploy Entrypoint: .env.example-Sourced Allowlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make adding a new deploy environment variable a normal pull request — no hand-edit of the untracked production entrypoint script required — while keeping typo protection and every existing safety invariant.

**Architecture:** `digico-ci-entrypoint` is the forced SSH command bound to the CI deploy key (`/usr/local/libexec/digico-ci-entrypoint` on the production server, root-owned, not previously tracked anywhere). It currently validates each incoming `KEY=value` line against a regex hardcoded in the script itself. The fix reorders it to fast-forward the `/srv/digico` checkout to `origin/main` _before_ validating, then derives the allowed-key set by parsing the just-updated `.env.example` instead of a hardcoded list. The script is added to this repo for the first time, with a bash test harness exercising every documented constraint plus the new "reads the freshly-fetched `.env.example`" behavior, then installed onto the production server to replace the untracked live copy.

**Tech Stack:** bash (`set -Eeuo pipefail`), git, GNU coreutils (`mktemp`, `flock`, `timeout`) — matches the existing `digico-deploy` script's style on the server (verified live, see recon below).

**Spec:** This plan's spec is the user's task brief (recorded in this repo's session, no separate doc) plus live reconnaissance performed against the production server on 2026-08-19:

- Live `/usr/local/libexec/digico-ci-entrypoint` was read via `admin@103.191.50.48:44444` and is byte-identical to the staged copy at `/Users/dhch/Documents/Codex/2026-08-09/i-ha/work/digico-ci-entrypoint`. That staged copy is this plan's known-good starting point.
- `/usr/local/sbin/digico-deploy` (the script the entrypoint `exec`s into via `sudo -n`) was also read. It runs, as the `deploy` user via `runuser`, exactly: `git -C /srv/digico fetch --prune origin main`, `git checkout --force main`, `git reset --hard origin/main`, then `make -C /srv/digico deploy` under `flock`. This confirms `/srv/digico` is the real path (not `/opt/digico`), that `deploy` owns the checkout with write access (no sudo needed for git ops), and gives the exact git command sequence to replicate in the entrypoint for consistency.
- `deploy.yml`'s current `Deploy` step payload only ever emits: `PORT`, `NODE_ENV`, `DEEPSEEK_MODEL`, `DEEPSEEK_API_KEY`, `ELEVENLABS_API_KEY` (conditional), `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`. None of `OPENAI_API_KEY`, `MARIADB_USER`, `MARIADB_PASSWORD`, `MARIADB_DATABASE`, `DATABASE_URL` are ever sent, even though the old hardcoded allowlist permits them. `.env.example` documents `MARIADB_URL` (uncommented) and `DATABASE_URL` (commented out, optional). **Known, intentional side effect:** switching the allowlist source to `.env.example`'s uncommented keys narrows the permitted set to drop those five unused keys. This has zero effect on current deploys (they're never sent) and is the correct behavior going forward — anyone who wants to send one of them must first document it in `.env.example`, which is the whole point of this change.

## Global Constraints

- The deployment key must never be able to run an arbitrary remote command: non-empty `SSH_ORIGINAL_COMMAND` → exit 126. (unchanged, do not touch this check)
- Payload is capped at 64KB (`max_bytes=65536` via `timeout 15 head -c`). (unchanged)
- `.env` is written via `mktemp` in the target directory, `chmod 600`, then atomic `mv -f`. (unchanged)
- An empty or absent payload (including whitespace-only) must leave the existing `.env` untouched — never truncate it. (unchanged)
- The allowlist rejects the **entire** payload on the first unrecognized key (fail closed, not "skip the bad line"). (unchanged behavior, new source)
- New: the allowlist is derived from `KEY=` lines in the repo's tracked `.env.example`, read from `/srv/digico/.env.example` _after_ the entrypoint fast-forwards that checkout to `origin/main` — not from a hardcoded list, and not from whatever commit happened to be checked out before this SSH session started.
- Every script this plan writes to the server must also live in this git repo, tracked, so "hand-edit a file on the production server" never has to happen again.

---

### Task 1: Write the entrypoint script and its test harness

**Files:**

- Create: `digico-ci-entrypoint` (repo root, mode 755)
- Create: `digico-ci-entrypoint.test.sh` (repo root, mode 755)
- Modify: `Makefile` (add `test-entrypoint` target + help line)

**Interfaces:**

- `digico-ci-entrypoint` reads `DIGICO_PROJECT_DIR` from the environment, defaulting to `/srv/digico`. This is the only testability seam — everything else (payload validation, git sync, sudo exec) is real. The seam is safe because it's an environment variable set by whoever _invokes_ the script (the test harness, or nothing in production), never something the untrusted stdin payload can influence.
- `digico-ci-entrypoint.test.sh` is a standalone bash script, no external test framework. It builds a fixture bare "origin" repo + a working checkout under a temp dir per test, points `DIGICO_PROJECT_DIR` at the checkout, and asserts on exit code / stderr / `.env` file contents & permissions.

- [ ] **Step 1: Write the test harness (red first)**

Create `digico-ci-entrypoint.test.sh`:

```bash
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

  assert_eq 'empty payload: .env untouched' "$(cat "${checkout}/.env")" 'PORT=1234'
  assert_eq 'empty payload: git sync skipped' "${before_head}" "$(git -C "${checkout}" rev-parse HEAD)"
  rm -rf "$(dirname "${checkout}")"
}

test_whitespace_only_payload_leaves_env_untouched() {
  local checkout
  checkout=$(make_fixture "${example_basic}")
  printf 'PORT=1234\n' > "${checkout}/.env"

  DIGICO_PROJECT_DIR="${checkout}" "${entrypoint}" <<< '   ' >/dev/null 2>&1 || true

  assert_eq 'whitespace payload: .env untouched' "$(cat "${checkout}/.env")" 'PORT=1234'
  rm -rf "$(dirname "${checkout}")"
}

test_valid_payload_is_written_with_correct_perms() {
  local checkout
  checkout=$(make_fixture "${example_basic}")

  DIGICO_PROJECT_DIR="${checkout}" "${entrypoint}" <<< $'PORT=9999\nDEEPSEEK_API_KEY=sk-test\n' >/dev/null 2>&1 || true

  assert_eq 'valid payload: .env content' "$(cat "${checkout}/.env")" $'PORT=9999\nDEEPSEEK_API_KEY=sk-test'
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
  assert_eq 'unknown key: .env untouched' "$(cat "${checkout}/.env")" 'PORT=1234'
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
  assert_eq 'fresh allowlist: .env content' "$(cat "${checkout}/.env" 2>/dev/null)" $'PORT=9999\nFOO_KEY=bar'
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
```

- [ ] **Step 2: Confirm red — the test file can't discriminate against the real old script directly, so prove it against a faithful stand-in**

The real pre-change script (`/Users/dhch/Documents/Codex/2026-08-09/i-ha/work/digico-ci-entrypoint`) hardcodes `readonly env_target='/srv/digico/.env'` with no way to point it at a fixture directory, so running the harness against it verbatim just fails every write-path test with `mktemp: mkstemp failed on /srv/digico/.env...: No such file or directory` — not a meaningful signal (verified while writing this plan). To get a real red/green comparison, patch a scratch copy of the script that has the `DIGICO_PROJECT_DIR` seam (so it's fixture-testable at all) but keeps the _old_ hardcoded allowlist regex in place of the new `.env.example`-parsing block, then run the suite against that copy by temporarily pointing `entrypoint` at it. Expect exactly 4 assertion failures, all tied to the new behavior: `missing .env.example: exit code` (old script has no such guard, exits 1 not 70), `missing .env.example: message`, `fresh allowlist: FOO_KEY not rejected` (old hardcoded regex doesn't know `FOO_KEY`), and `fresh allowlist: .env content`. Every other assertion (SSH_ORIGINAL_COMMAND rejection, empty/whitespace payload untouched, valid payload content+0600 perms, unknown-key and malformed-line rejection, oversized-payload rejection) must still pass — that's what proves the suite isn't accidentally testing something else. (This was verified directly: 13 passed, 4 failed, matching exactly this prediction.)

- [ ] **Step 3: Replace `digico-ci-entrypoint` with the reordered, `.env.example`-sourced version**

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

project_dir="${DIGICO_PROJECT_DIR:-/srv/digico}"
readonly project_dir
readonly env_target="${project_dir}/.env"
readonly env_example="${project_dir}/.env.example"
readonly max_bytes=65536

# The deployment key must never be able to run an arbitrary remote command.
if [[ -n "${SSH_ORIGINAL_COMMAND:-}" ]]; then
  printf '%s\n' 'direct SSH commands are not permitted for this deployment key' >&2
  exit 126
fi

# An environment payload on stdin is optional. When absent (e.g. `ssh -n`), the
# existing .env is left untouched rather than being clobbered with an empty file.
payload=''
if [[ ! -t 0 ]]; then
  payload=$(timeout 15 head -c "${max_bytes}" || true)
fi

if [[ -n "${payload//[[:space:]]/}" ]]; then
  # Fast-forward before reading .env.example, so the allowlist reflects the
  # commit about to be deployed rather than whatever main pointed to last time
  # this ran. digico-deploy repeats this same sequence for the real deploy;
  # doing it again there is a no-op once this has already moved the tree.
  git -C "${project_dir}" fetch --prune origin main
  git -C "${project_dir}" checkout --force main
  git -C "${project_dir}" reset --hard origin/main

  if [[ ! -f "${env_example}" ]]; then
    printf '%s\n' "missing ${env_example}; refusing to write ${env_target}" >&2
    exit 70
  fi

  allowed_keys=''
  while IFS= read -r line || [[ -n "${line}" ]]; do
    [[ "${line}" =~ ^([A-Za-z_][A-Za-z0-9_]*)= ]] || continue
    allowed_keys+="${allowed_keys:+|}${BASH_REMATCH[1]}"
  done < "${env_example}"

  if [[ -z "${allowed_keys}" ]]; then
    printf '%s\n' "no keys found in ${env_example}; refusing to write ${env_target}" >&2
    exit 70
  fi

  readonly allowed_key="^(${allowed_keys})="

  tmp=$(mktemp "${env_target}.XXXXXX")
  trap 'rm -f "${tmp}"' EXIT
  chmod 600 "${tmp}"

  while IFS= read -r line; do
    [[ -z "${line}" || "${line}" == '#'* ]] && continue
    if [[ ! "${line}" =~ ${allowed_key} ]]; then
      # Print only the key, never any part of the value: this goes to the CI log.
      key=${line%%=*}
      if [[ "${key}" == "${line}" ]]; then
        printf 'rejected malformed environment line (no "=")\n' >&2
      else
        printf 'rejected environment line (key not allowed): %s\n' "${key}" >&2
      fi
      exit 65
    fi
    printf '%s\n' "${line}"
  done <<< "${payload}" > "${tmp}"

  mv -f "${tmp}" "${env_target}"
  trap - EXIT
  printf '%s\n' "updated ${env_target} from deployment payload"
fi

exec /usr/bin/sudo -n /usr/local/sbin/digico-deploy
```

- [ ] **Step 4: Run the test harness again to confirm all cases pass (green)**

```bash
./digico-ci-entrypoint.test.sh
```

Expected: `17 passed, 0 failed` (one count per `assert_*` call across the 9 test functions, not per function — verified while writing this plan).

- [ ] **Step 5: Wire the test into `Makefile` and CI**

In `Makefile`, add near `test-e2e`:

```makefile
## test-entrypoint: Run the CI deploy entrypoint's bash test suite
test-entrypoint:
	./digico-ci-entrypoint.test.sh
```

Add `test-entrypoint` to the `.PHONY` line, and a help line next to `test-e2e`'s:

```
	@echo "  make test-entrypoint - Run the CI deploy entrypoint's bash test suite"
```

In `.github/workflows/deploy.yml`, add a step in the `test` job right after `Unit tests`:

```yaml
- name: Test CI deploy entrypoint script
  run: make test-entrypoint
```

- [ ] **Step 6: Commit**

```bash
git add digico-ci-entrypoint digico-ci-entrypoint.test.sh Makefile .github/workflows/deploy.yml
git commit -m "$(cat <<'EOF'
feat(ci): track the deploy entrypoint and source its allowlist from .env.example

The forced-command entrypoint that gates every production .env write lived only
on the server, untracked, with a hardcoded key whitelist. Adding a new deploy
variable meant hand-editing that file by SSH — ELEVENLABS_API_KEY nearly broke
the next merge to main because of it. The entrypoint now fetches/resets
/srv/digico to origin/main before validating, then derives its allowlist from
the freshly-synced .env.example instead of a hardcoded regex, so a new variable
is just .env.example + deploy.yml + a repo secret, in one PR. Typo protection
is unchanged: an unrecognized key still rejects the whole payload.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Correct the deploy.yml comment block

**Files:**

- Modify: `.github/workflows/deploy.yml:100-122` (the comment above the `Deploy` step)

**Interfaces:** None — comment-only change.

- [ ] **Step 1: Replace the comment block**

Replace lines 100-122 (the block starting `# No remote command is sent...` through `# Omitting it keeps any such failure scoped to whoever opts into voice.`) with:

```yaml
# No remote command is sent. The deploy account's authorized_keys pins the CI
# key to a forced command, digico-ci-entrypoint (tracked at
# ../../digico-ci-entrypoint in this repo, installed at
# /usr/local/libexec/digico-ci-entrypoint on the server), which reads this
# environment payload from stdin and deploys.
#
# Verified by reading the live script: arbitrary remote commands are refused
# (SSH_ORIGINAL_COMMAND non-empty -> exit 126); every payload key is checked
# against the keys declared in the repo's .env.example (fetched fresh from
# origin/main first) and the WHOLE payload is rejected on the first
# unrecognized key; and /srv/digico/.env is written via mktemp + chmod 600 +
# atomic mv, never truncated by an empty payload.
#
# ELEVENLABS_API_KEY is deliberately absent from the required-secrets check
# above: voice transcription is optional, and its absence degrades gracefully
# (transcribeAudio throws a configuration error, handleIncomingMessage catches
# it and asks the dealer to type instead).
#
# Its line is emitted only when the secret is non-empty, so an unset secret
# cannot fail unrelated deploys. Any new variable added here must also be
# added to .env.example — the entrypoint rejects the whole payload otherwise.
- name: Deploy
```

- [ ] **Step 2: Verify the workflow YAML is still valid**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))" && echo "YAML OK"
```

Expected: `YAML OK`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "$(cat <<'EOF'
docs(ci): confirm the entrypoint's verified behaviour in the deploy comment

The previous comment marked the allowlist/0600 behaviour "NOT verified" because
nobody had read the live script. It's now been read directly on the server and
tracked in this repo (see digico-ci-entrypoint), so state what it actually does
instead of hedging.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Fix the stale `/opt/digico` path and the matching stale README note

**Files:**

- Modify: `server-setup-el10.sh:114-134`
- Modify: `README.md:207-211`

**Interfaces:** None — doc/comment and literal-path changes only.

- [ ] **Step 1: Fix `server-setup-el10.sh`**

Replace the block:

```bash
# 8. Setup App Directory
#
# NOTE: this provisions /opt/digico, but the CI deploy pipeline
# (.github/workflows/deploy.yml) documents the live checkout as /srv/digico. One
# of the two is stale and nobody has confirmed which — the production server was
# configured out-of-band, including the digico-ci-entrypoint forced command that
# this script does not create. Confirm the real path on the server before relying
# on either. The "next steps" below likewise describe a manual deploy that the CI
# pipeline has since replaced.
echo "[8/8] Preparing /opt/digico deployment directory..."
mkdir -p /opt/digico
chown -R deploy:deploy /opt/digico

echo "=========================================================="
echo " SUCCESS: Server setup & hardening complete!"
echo " Next steps:"
echo " 1. Set password for deploy user: passwd deploy"
echo " 2. Log in as deploy: su - deploy"
echo " 3. Navigate to /opt/digico and clone project codebase"
echo " 4. Configure .env and execute ./deploy.sh"
echo "=========================================================="
```

with:

```bash
# 8. Setup App Directory
#
# Confirmed live path: /srv/digico. The production server's forced-command CI
# deploy setup (digico-ci-entrypoint, digico-deploy, sudoers, authorized_keys) is
# configured out-of-band and is not created by this script — see
# digico-ci-entrypoint in this repo for the tracked copy of the entrypoint.
echo "[8/8] Preparing /srv/digico deployment directory..."
mkdir -p /srv/digico
chown -R deploy:deploy /srv/digico

echo "=========================================================="
echo " SUCCESS: Server setup & hardening complete!"
echo " Next steps:"
echo " 1. Set password for deploy user: passwd deploy"
echo " 2. Log in as deploy: su - deploy"
echo " 3. Navigate to /srv/digico and clone project codebase"
echo " 4. Configure .env and execute ./deploy.sh"
echo "=========================================================="
```

- [ ] **Step 2: Fix the matching stale note in `README.md`**

Replace:

```markdown
> - Deploying it requires `ELEVENLABS_API_KEY` in the repository secrets. The deploy workflow emits it only when non-empty, so an unset secret cannot affect unrelated deploys.
> - **Unverified:** whether `digico-ci-entrypoint` on the production server filters payload keys. If it does, the key must be permitted there too. The script is not in this repo, and no one has confirmed its contents — see the comment in `.github/workflows/deploy.yml`.
```

with:

```markdown
> - Deploying it requires `ELEVENLABS_API_KEY` in the repository secrets. The deploy workflow emits it only when non-empty, so an unset secret cannot affect unrelated deploys.
> - `digico-ci-entrypoint` (tracked at `digico-ci-entrypoint` in this repo) validates every deploy payload key against `.env.example`. A new variable needs to be added there too, or the whole deploy payload is rejected — see the comment in `.github/workflows/deploy.yml`.
```

- [ ] **Step 3: Verify no other stale `/opt/digico` references remain**

```bash
grep -rn "opt/digico" --include="*.md" --include="*.sh" --include="*.yml" .
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add server-setup-el10.sh README.md
git commit -m "$(cat <<'EOF'
fix(ops): correct the stale /opt/digico path to /srv/digico

server-setup-el10.sh provisioned /opt/digico and told the operator to clone
there, but the live checkout, digico-deploy, and digico-ci-entrypoint all use
/srv/digico — confirmed by reading the production server directly. Also
updates README's matching stale "unverified" note now that the entrypoint has
been read and tracked (see digico-ci-entrypoint).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Install the new entrypoint on the production server

**This task touches a live production system and must not proceed without explicit user confirmation before each write step**, per the standing safety rules on hard-to-reverse, shared-system actions.

**Files:** None in-repo — this task deploys Task 1's already-committed `digico-ci-entrypoint` to `admin@103.191.50.48:44444`.

- [ ] **Step 1: Confirm with the user before touching the server**

State exactly what will change (root-owned file at `/usr/local/libexec/digico-ci-entrypoint`, backed up first, replaced with the git-tracked version) and get an explicit go-ahead.

- [ ] **Step 2: Copy the new script to the server and diff it against what's about to be replaced**

```bash
scp -P 44444 digico-ci-entrypoint admin@103.191.50.48:/tmp/digico-ci-entrypoint.new
ssh -p 44444 admin@103.191.50.48 'diff /usr/local/libexec/digico-ci-entrypoint /tmp/digico-ci-entrypoint.new; echo "diff exit: $?"'
```

Expected: a non-empty diff exit 1 (they differ — that's the point) with the printed diff matching exactly Task 1's changes (git sync + `.env.example`-derived allowlist replacing the hardcoded one). Read the diff before proceeding; if it shows anything unexpected, stop.

- [ ] **Step 3: Back up the live script, then install the new one with matching ownership/permissions**

```bash
ssh -p 44444 admin@103.191.50.48 '
set -e
sudo cp /usr/local/libexec/digico-ci-entrypoint /usr/local/libexec/digico-ci-entrypoint.pre-env-example-allowlist.bak
sudo install -o root -g root -m 0755 /tmp/digico-ci-entrypoint.new /usr/local/libexec/digico-ci-entrypoint
rm -f /tmp/digico-ci-entrypoint.new
sudo ls -la /usr/local/libexec/ | grep digico
'
```

Expected: `digico-ci-entrypoint` present at `-rwxr-xr-x root root`, plus the new `.pre-env-example-allowlist.bak` alongside the two existing backups.

- [ ] **Step 4: Verify the rejection paths against the live install without triggering a real deploy**

Every successful run of this script ends in `exec sudo -n digico-deploy`, which really deploys — so only exercise paths that exit _before_ that line.

```bash
ssh -p 44444 admin@103.191.50.48 "
sudo -iu deploy bash -c '/usr/local/libexec/digico-ci-entrypoint <<< \"BADKEY=x\"; echo EXIT:\$?'
"
```

Expected: `rejected environment line (key not allowed): BADKEY` and `EXIT:65`. Confirm afterward that `/srv/digico/.env`'s mtime is unchanged (`ssh ... 'sudo stat /srv/digico/.env'`, compare to before this step).

- [ ] **Step 5: Note the real end-to-end verification**

The accept path (valid payload -> `.env` written -> real deploy) can only be tested by an actual deploy, which is exactly what the next merge to `main` will do through the normal CI pipeline — that merge is this task's real integration test. Tell the user this explicitly rather than manufacturing a synthetic production deploy here.
