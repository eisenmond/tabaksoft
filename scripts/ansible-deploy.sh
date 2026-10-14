#!/usr/bin/env bash
# Small, predictable entry point for initial setup and application rebuilds.

set -Eeuo pipefail

readonly SCRIPT_NAME="${0##*/}"
readonly REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
readonly INVENTORY_FILE="${REPOSITORY_ROOT}/ansible/inventory/hosts.yml"
readonly VAULT_FILE="${REPOSITORY_ROOT}/ansible/group_vars/mern_basic.vault.yml"

usage() {
  cat <<EOF
Usage: ${SCRIPT_NAME} setup [ANSIBLE_OPTIONS...]
       ${SCRIPT_NAME} rebuild [ANSIBLE_OPTIONS...]

  setup    Run the complete provisioning playbook and prompt for the Vault password.
  rebuild  Publish the current checkout to an existing deployment.

Additional arguments are passed directly to ansible-playbook. For a sudo account
that requires a password, the script prompts for it automatically when deploying
locally. For remote hosts, append --ask-become-pass when required.
EOF
}

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

has_become_prompt_option() {
  local option
  for option in "$@"; do
    [[ $option == --ask-become-pass || $option == -K ]] && return 0
  done
  return 1
}

inventory_uses_local_connection() {
  ansible-inventory -i "$INVENTORY_FILE" --list | python3 -c '
import json
import sys

inventory = json.load(sys.stdin)
hostvars = inventory.get("_meta", {}).get("hostvars", {})
raise SystemExit(not any(
    variables.get("ansible_connection") == "local"
    for variables in hostvars.values()
))
'
}

main() {
  local action=${1:-}
  [[ $action != -h && $action != --help ]] || { usage; return; }
  [[ -n $action ]] || { usage >&2; exit 2; }
  shift

  command -v ansible-playbook >/dev/null 2>&1 || die 'ansible-playbook is not installed.'
  command -v ansible-inventory >/dev/null 2>&1 || die 'ansible-inventory is not installed.'
  command -v python3 >/dev/null 2>&1 || die 'python3 is not installed.'
  [[ -f $INVENTORY_FILE ]] || die 'Inventory is missing; run ./scripts/setup-ansible.sh first.'

  local -a become_options=()
  if ! has_become_prompt_option "$@" && inventory_uses_local_connection &&
      [[ $EUID -ne 0 ]] && ! sudo -n true 2>/dev/null; then
    become_options+=(--ask-become-pass)
  fi

  case $action in
    setup)
      [[ -f $VAULT_FILE ]] || die 'Vault is missing; run ./scripts/setup-ansible.sh first.'
      exec ansible-playbook -i "$INVENTORY_FILE" "${REPOSITORY_ROOT}/ansible/site.yml" \
        -e "@${VAULT_FILE}" --ask-vault-pass "${become_options[@]}" "$@"
      ;;
    rebuild)
      exec ansible-playbook -i "$INVENTORY_FILE" "${REPOSITORY_ROOT}/ansible/rebuild.yml" \
        "${become_options[@]}" "$@"
      ;;
    *)
      die "Unknown action '${action}'; expected setup or rebuild."
      ;;
  esac
}

main "$@"
