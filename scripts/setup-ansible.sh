#!/usr/bin/env bash
# Prepare this checkout for an Ansible deployment without storing plaintext secrets.

set -Eeuo pipefail

readonly SCRIPT_NAME="${0##*/}"
readonly REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
readonly ANSIBLE_DIRECTORY="${REPOSITORY_ROOT}/ansible"
readonly INVENTORY_FILE="${ANSIBLE_DIRECTORY}/inventory/hosts.yml"
readonly VARIABLES_FILE="${ANSIBLE_DIRECTORY}/group_vars/mern_basic.yml"
readonly VAULT_FILE="${ANSIBLE_DIRECTORY}/group_vars/mern_basic.vault.yml"

TEMP_DIRECTORY=""

usage() {
  cat <<EOF
Usage: ${SCRIPT_NAME}

Interactively create the inventory, deployment settings, and encrypted Ansible
Vault required by ansible/site.yml. Existing local configuration is backed up
before it is replaced. No plaintext credential is retained.
EOF
}

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  if [[ -n $TEMP_DIRECTORY && -d $TEMP_DIRECTORY ]]; then
    rm -rf -- "$TEMP_DIRECTORY"
  fi
}
trap cleanup EXIT

prompt() {
  local destination=$1 label=$2 default=${3-} value
  if [[ -n $default ]]; then
    read -r -p "${label} [${default}]: " value
    value=${value:-$default}
  else
    while [[ -z ${value:-} ]]; do
      read -r -p "${label}: " value
    done
  fi
  printf -v "$destination" '%s' "$value"
}

prompt_secret() {
  local destination=$1 label=$2 minimum=$3 first second
  while :; do
    read -r -s -p "${label}: " first; printf '\n' >&2
    read -r -s -p "Confirm ${label}: " second; printf '\n' >&2
    [[ $first == "$second" ]] || { printf 'Values did not match; try again.\n' >&2; continue; }
    ((${#first} >= minimum)) || { printf 'Value must contain at least %s characters.\n' "$minimum" >&2; continue; }
    printf -v "$destination" '%s' "$first"
    return
  done
}

prompt_or_generate_secret() {
  local destination=$1 label=$2 minimum=$3 answer generated
  read -r -p "Generate a strong ${label}? [Y/n]: " answer
  if [[ ! $answer =~ ^[Nn]$ ]]; then
    generated=$(openssl rand -base64 48 | tr -d '\n')
    printf -v "$destination" '%s' "$generated"
    printf 'Generated %s.\n' "$label"
  else
    prompt_secret "$destination" "$label" "$minimum"
  fi
}

yaml_quote() {
  local value=${1//\'/\'\'}
  printf "'%s'" "$value"
}

backup_if_present() {
  local file=$1 timestamp
  if [[ -e $file ]]; then
    timestamp=$(date -u +%Y%m%dT%H%M%SZ)
    cp -p -- "$file" "${file}.${timestamp}.bak"
    printf 'Backed up %s to %s\n' "$file" "${file}.${timestamp}.bak"
  fi
}

write_inventory() {
  local mode=$1 hosts=$2 ssh_user=$3 host index=0
  local -a target_hosts=()
  if [[ $mode == local ]]; then
    cat >"$INVENTORY_FILE" <<'EOF'
---
mern_basic:
  hosts:
    localhost:
      ansible_connection: local
EOF
    return
  fi

  read -r -a target_hosts <<<"$hosts"
  {
    printf '%s\n' '---' 'mern_basic:' '  hosts:'
    for host in "${target_hosts[@]}"; do
      ((index += 1))
      printf '    host_%s:\n      ansible_host: ' "$index"
      yaml_quote "$host"
      printf '\n      ansible_user: '
      yaml_quote "$ssh_user"
      printf '\n'
    done
  } >"$INVENTORY_FILE"
}

main() {
  [[ ${1:-} != -h && ${1:-} != --help ]] || { usage; return; }
  (($# == 0)) || die 'This script does not accept arguments (use --help for usage).'
  for command in ansible-playbook ansible-inventory ansible-galaxy ansible-vault openssl; do
    command -v "$command" >/dev/null 2>&1 || die "Required command not found: ${command}"
  done

  local deployment_mode hosts='' ssh_user='' domain='localhost' local_only
  local exposure_answer
  local firewall_enabled firewall_answer ssh_port=22 http_port=80
  local mongo_database mongo_user mongo_password bootstrap_password jwt_secret
  local admin_email admin_password vault_password vault_plaintext vault_password_file

  printf 'Configure the Ansible controller for mern-basic.\n\n'
  read -r -p 'Deploy to this machine (local connection)? [Y/n]: ' deployment_mode
  if [[ $deployment_mode =~ ^[Nn]$ ]]; then
    deployment_mode=remote
    while [[ -z $hosts ]]; do
      read -r -p 'Target IP addresses or DNS names (space separated): ' hosts
    done
    hosts=${hosts//,/ }
    prompt ssh_user 'SSH user' "${USER:-deploy}"
  else
    deployment_mode=local
  fi

  read -r -p 'Restrict the web application to the target machine only? [y/N]: ' exposure_answer
  if [[ $exposure_answer =~ ^[Yy]$ ]]; then
    local_only=true
  else
    local_only=false
    if [[ $deployment_mode == remote ]]; then
      prompt domain 'Public domain (or one target IP)' "${hosts%% *}"
    else
      prompt domain 'Public domain or network-reachable IP for this machine' "$(hostname -f 2>/dev/null || hostname)"
    fi
    [[ $domain =~ ^[A-Za-z0-9.-]+$ ]] || die 'Domain must be one DNS name or IPv4 address without a scheme, port, or whitespace.'
  fi

  read -r -p 'Configure the host firewall? [Y/n]: ' firewall_answer
  [[ $firewall_answer =~ ^[Nn]$ ]] && firewall_enabled=false || firewall_enabled=true
  prompt ssh_port 'SSH port to preserve in the firewall' '22'
  prompt http_port 'HTTP port' '80'
  [[ $ssh_port =~ ^[0-9]+$ && $ssh_port -ge 1 && $ssh_port -le 65535 ]] || die 'SSH port must be between 1 and 65535.'
  [[ $http_port =~ ^[0-9]+$ && $http_port -ge 1 && $http_port -le 65535 ]] || die 'HTTP port must be between 1 and 65535.'

  prompt mongo_database 'MongoDB database' 'mern_template'
  prompt mongo_user 'MongoDB application user' 'mern_app'
  prompt_secret mongo_password 'MongoDB application password' 12
  prompt_secret bootstrap_password 'MongoDB bootstrap-management password' 12
  prompt_or_generate_secret jwt_secret 'JWT secret' 32
  prompt admin_email 'Administrator email' 'admin@example.com'
  prompt_secret admin_password 'Administrator password' 12
  prompt_secret vault_password 'New Ansible Vault password' 8

  mkdir -p "$(dirname "$INVENTORY_FILE")" "$(dirname "$VARIABLES_FILE")"
  backup_if_present "$INVENTORY_FILE"
  backup_if_present "$VARIABLES_FILE"
  backup_if_present "$VAULT_FILE"
  write_inventory "$deployment_mode" "$hosts" "$ssh_user"

  cat >"$VARIABLES_FILE" <<EOF
---
# Generated by scripts/setup-ansible.sh. Secrets belong in the encrypted Vault.
mern_domain: $(yaml_quote "$domain")
mern_local_only: ${local_only}
mern_firewall_enabled: ${firewall_enabled}
mern_firewall_ssh_port: ${ssh_port}
mern_firewall_http_port: ${http_port}
mern_mongodb_database: $(yaml_quote "$mongo_database")
mern_mongodb_user: $(yaml_quote "$mongo_user")
EOF
  chmod 600 "$INVENTORY_FILE" "$VARIABLES_FILE"

  TEMP_DIRECTORY=$(mktemp -d)
  chmod 700 "$TEMP_DIRECTORY"
  vault_plaintext="${TEMP_DIRECTORY}/vault.yml"
  vault_password_file="${TEMP_DIRECTORY}/vault-password"
  cat >"$vault_plaintext" <<EOF
---
mern_mongodb_password: $(yaml_quote "$mongo_password")
mern_mongodb_bootstrap_password: $(yaml_quote "$bootstrap_password")
mern_jwt_secret: $(yaml_quote "$jwt_secret")
mern_admin_email: $(yaml_quote "$admin_email")
mern_admin_password: $(yaml_quote "$admin_password")
EOF
  printf '%s' "$vault_password" >"$vault_password_file"
  chmod 600 "$vault_plaintext" "$vault_password_file"
  ansible-vault encrypt --vault-password-file "$vault_password_file" --output "$VAULT_FILE" "$vault_plaintext"
  chmod 600 "$VAULT_FILE"

  printf '\nInstalling required Ansible collections...\n'
  ansible-galaxy collection install -r "${ANSIBLE_DIRECTORY}/requirements.yml"
  printf '\nValidating inventory and playbook...\n'
  ansible-inventory -i "$INVENTORY_FILE" --graph
  ansible-playbook -i "$INVENTORY_FILE" "${ANSIBLE_DIRECTORY}/site.yml" \
    -e "@${VAULT_FILE}" --vault-password-file "$vault_password_file" --syntax-check

  printf '\nAnsible configuration is ready. Deploy with:\n  ./scripts/ansible-deploy.sh setup\n'
}

main "$@"
