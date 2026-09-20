#!/usr/bin/env bash
# Stages a self-contained Nasiko project for each Vitta agent and (unless --dry-run) deploys it.
#
#   nasiko/deploy.sh [planner|discovery|evaluator|purchase|all] [--dry-run | --upload]
#
#   (default)   `nasiko validate && nasiko deploy` per agent — needs the Rust `nasiko` CLI.
#   --dry-run   stage only.
#   --upload    no CLI needed: zips each staged project and POSTs it to a running control plane's
#               `POST /api/import/upload` (the language-agnostic import; `/api/agents/upload` insists on
#               a Python main.py and would reject these Node agents). Nasiko builds and starts the image.
#               `all` skips `purchase` here — it needs the gate's local state, see nasiko/README.md.
#                 NASIKO_URL          control plane, default http://localhost:8080
#                 NASIKO_TOKEN        bearer token, or:
#                 NASIKO_PASSWORD     log in as NASIKO_USERNAME (default admin) to get one
#                 VITTA_DASHBOARD_URL optional; set as a secret on the discovery agent, which is then
#                                     redeployed (a container only receives secrets when it is deployed, and
#                                     does not read .env — from Docker on macOS the host is
#                                     http://host.docker.internal:<port>)
#               Re-running for an agent Nasiko already holds redeploys it as the next patch version
#               (Nasiko refuses to re-import a version it has seen).
#
# Each agent needs its own project directory (AgentCard.json + Dockerfile + source) because
# `nasiko deploy <dir>` builds a directory. The agents share one codebase, so this script assembles
# one directory per agent from the compiled output rather than keeping four copies in git.
#
# The staging, `docker build` and `--upload` paths are exercised against a local control plane; the
# `nasiko deploy` (CLI) call follows the documented quickstart (docs.nasiko.com/quickstart) and has not
# been run — see nasiko/README.md ("Status").
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WHICH=all
MODE=cli
for arg in "$@"; do
  case "$arg" in
    --dry-run) MODE=dry ;;
    --upload)  MODE=upload ;;
    *)         WHICH="$arg" ;;
  esac
done

# (a case, not an associative array: macOS still ships bash 3.2)
name_for() {
  case "$1" in
    planner)   echo vitta-shopping-planner ;;
    discovery) echo vitta-deal-discovery ;;
    evaluator) echo vitta-deal-evaluator ;;
    purchase)  echo vitta-purchase-agent ;;
    *)         return 1 ;;
  esac
}

if [[ "$WHICH" == "all" ]]; then
  if [[ "$MODE" == "upload" ]]; then TARGETS=(planner discovery evaluator); else TARGETS=(planner discovery evaluator purchase); fi
else
  TARGETS=("$WHICH")
fi
for short in "${TARGETS[@]}"; do
  name_for "$short" >/dev/null || { echo "unknown agent: $short (planner|discovery|evaluator|purchase|all)" >&2; exit 2; }
done

NASIKO_URL="${NASIKO_URL:-http://localhost:8080}"
NASIKO_URL="${NASIKO_URL%/}"

json_field() { # json_field <dotted.path> < json
  python3 -c 'import json,sys
v = json.load(sys.stdin)
for k in sys.argv[1].split("."):
    v = v.get(k) if isinstance(v, dict) else None
print("" if v is None else v)' "$1"
}

nasiko_token() {
  if [[ -n "${NASIKO_TOKEN:-}" ]]; then printf '%s' "$NASIKO_TOKEN"; return; fi
  [[ -n "${NASIKO_PASSWORD:-}" ]] || { echo "set NASIKO_TOKEN, or NASIKO_PASSWORD (and NASIKO_USERNAME, default admin)" >&2; return 1; }
  NASIKO_USERNAME="${NASIKO_USERNAME:-admin}" python3 -c 'import json,os
print(json.dumps({"username": os.environ["NASIKO_USERNAME"], "password": os.environ["NASIKO_PASSWORD"]}))' \
    | curl -fsS -m 20 -X POST "$NASIKO_URL/api/auth/login" -H 'Content-Type: application/json' -d @- \
    | json_field token
}

upload_agent() { # upload_agent <stage dir>  -> prints Nasiko's agent id
  local zip="$1.zip" out code
  rm -f "$zip" && (cd "$1" && zip -qr "$zip" .)
  # The import builds the image before it answers, so this can take minutes on a first build.
  out="$(curl -sS -m 900 -w '\n%{http_code}' -H "Authorization: Bearer $TOKEN" \
    -F "package=@$zip;type=application/zip" "$NASIKO_URL/api/import/upload")"
  code="${out##*$'\n'}"; out="${out%$'\n'*}"
  if [[ "$code" != 2* ]]; then echo "    upload failed (HTTP $code): $out" >&2; return 1; fi
  printf '%s' "$out" | json_field agent_id
}

set_secret() { # set_secret <agent id> <name> <value>
  python3 -c 'import json,sys; print(json.dumps({"name": sys.argv[1], "value": sys.argv[2]}))' "$2" "$3" \
    | curl -fsS -m 20 -X POST "$NASIKO_URL/api/agents/$1/secrets" \
        -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d @- >/dev/null
}

find_agent() { # find_agent <name> -> "<id> <version>" of the caller's existing agent, or nothing
  curl -fsS -m 20 -H "Authorization: Bearer $TOKEN" "$NASIKO_URL/api/agents" | python3 -c 'import json,sys
d = json.load(sys.stdin)
for a in (d if isinstance(d, list) else d.get("agents", [])):
    if a.get("name") == sys.argv[1]:
        print(a["id"], a.get("version") or "0.0.0"); break' "$1"
}

bump_card_version() { # bump_card_version <stage dir> <version to exceed>
  # An import of a version Nasiko already holds is refused (409), and a container only gets new
  # secrets when it is redeployed — so a re-run, or a secret change, ships as the next patch version.
  python3 -c 'import json,sys
p, floor = sys.argv[1] + "/AgentCard.json", [int(x) for x in sys.argv[2].split(".")]
card = json.load(open(p))
cur = [int(x) for x in card["version"].split(".")]
if cur <= floor:
    card["version"] = "%d.%d.%d" % (floor[0], floor[1], floor[2] + 1)
    json.dump(card, open(p, "w"), indent=2)
print(card["version"])' "$1" "$2"
}

echo "==> compiling"
(cd "$ROOT" && npm run --silent build && npm run --silent nasiko:cards >/dev/null)

if [[ "$MODE" == "upload" ]]; then
  echo "==> logging in to $NASIKO_URL"
  TOKEN="$(nasiko_token)"
  [[ -n "$TOKEN" ]] || { echo "could not get a Nasiko token" >&2; exit 1; }
fi

SUMMARY=()
for short in "${TARGETS[@]}"; do
  name="$(name_for "$short")"
  stage="$ROOT/nasiko/.build/$name"
  echo "==> staging $name -> ${stage#$ROOT/}"
  rm -rf "$stage" && mkdir -p "$stage"
  cp "$ROOT/nasiko/agents/$name/AgentCard.json" "$stage/AgentCard.json"
  sed "s/^ARG AGENT=.*/ARG AGENT=$short/" "$ROOT/nasiko/Dockerfile" > "$stage/Dockerfile"
  cp "$ROOT/package.json" "$ROOT/manifest.json" "$stage/"
  cp -R "$ROOT/dist" "$stage/dist"
  find "$stage/dist" -name '*.test.js' -delete

  case "$MODE" in
    dry)
      echo "    (dry run) would run: nasiko validate && nasiko deploy ${stage#$ROOT/}  (or --upload)"
      ;;
    upload)
      want_secret=0; [[ "$short" == "discovery" && -n "${VITTA_DASHBOARD_URL:-}" ]] && want_secret=1
      existing="$(find_agent "$name")"; id="${existing%% *}"
      if [[ -n "$existing" ]]; then
        version="$(bump_card_version "$stage" "${existing#* }")"
        echo "    $name already in Nasiko as $id (v${existing#* }) — redeploying as v$version"
        [[ $want_secret -eq 1 ]] && set_secret "$id" VITTA_DASHBOARD_URL "$VITTA_DASHBOARD_URL"
      fi
      echo "==> uploading $name (Nasiko builds the image; first build takes a while)"
      id="$(upload_agent "$stage")"
      [[ -n "$id" ]] || { echo "    upload returned no agent id" >&2; exit 1; }
      if [[ -z "$existing" && $want_secret -eq 1 ]]; then
        # The agent id only exists after the first import, and secrets are read at deploy time.
        echo "    setting VITTA_DASHBOARD_URL and redeploying so the container receives it"
        set_secret "$id" VITTA_DASHBOARD_URL "$VITTA_DASHBOARD_URL"
        version="$(bump_card_version "$stage" "$(json_field version < "$stage/AgentCard.json")")"
        upload_agent "$stage" >/dev/null
      fi
      echo "    Nasiko agent id: $id"
      SUMMARY+=("NASIKO_AGENT_ID_$(echo "$short" | tr a-z A-Z)=$id")
      ;;
    *)
      command -v nasiko >/dev/null || { echo "the nasiko CLI is not installed — see nasiko/README.md (or use --upload)" >&2; exit 1; }
      (cd "$stage" && nasiko validate && nasiko deploy .)
      echo "    Nasiko's id for $name is in ${stage#$ROOT/}/.nasiko/agent.json — put it in .env as NASIKO_AGENT_ID_$(echo "$short" | tr a-z A-Z)"
      ;;
  esac
done

if [[ "$MODE" == "upload" ]]; then
  echo
  echo "==> add to .env (NASIKO_TOKEN is the login token; it expires, so re-run to refresh):"
  echo "NASIKO_URL=$NASIKO_URL"
  for line in "${SUMMARY[@]}"; do echo "$line"; done
fi
