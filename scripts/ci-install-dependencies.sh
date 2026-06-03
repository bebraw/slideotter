#!/usr/bin/env bash
set -euo pipefail

if [ "${AGENT_CI_LOCAL:-}" != "true" ]; then
  npm ci
  exit 0
fi

lock_hash="$(sha256sum package-lock.json | awk '{ print $1 }')"
agent_ci_state_dir="${RUNNER_TOOL_CACHE:-/opt/hostedtoolcache}/agent-ci-npm"
lock_dir="${agent_ci_state_dir}/npm-ci.lock"
ready_file="${agent_ci_state_dir}/node-modules-${lock_hash}.ready"

mkdir -p "${agent_ci_state_dir}"

if [ -f "${lock_dir}" ]; then
  rm -f "${lock_dir}"
fi

while ! mkdir "${lock_dir}" 2>/dev/null; do
  if [ -f "${lock_dir}/created-at" ]; then
    lock_age=$(($(date +%s) - $(cat "${lock_dir}/created-at" 2>/dev/null || echo 0)))
    if [ "${lock_age}" -gt 600 ]; then
      rm -rf "${lock_dir}"
      continue
    fi
  fi

  sleep 1
done

trap 'rm -rf "${lock_dir}"' EXIT
date +%s >"${lock_dir}/created-at"

if [ -f "${ready_file}" ] && [ -f node_modules/.package-lock.json ]; then
  echo "Agent CI warm node_modules already matches package-lock.json."
  exit 0
fi

rm -f "${agent_ci_state_dir}"/node-modules-*.ready
npm ci
touch "${ready_file}"
