# MERN application template

A WordPress-inspired publishing baseline: a React administration dashboard and an Express/MongoDB API with a setup-provisioned administrator, JWT authentication, role-based user management, input validation, pagination, error handling, rate limiting, and health checks.

See [`BASELINE.md`](BASELINE.md) for the capabilities already included, the
recommended next features for a client-ready web application, and the features
that should remain optional integrations rather than template dependencies.

## Structure

- `frontend/` — React starter interface and small API client.
- `backend/src/controllers/` — HTTP request/response orchestration.
- `backend/src/dao/` — MongoDB access and collection indexes.
- `backend/src/routes/` — versioned public API routes.
- `backend/src/lib/` and `middleware/` — shared validation, crypto, serialization, auth, security, and error conventions.

Read [`backend/README.md`](backend/README.md) for configuration and API details. Never commit `.env`; use [`backend/.env.example`](backend/.env.example) as the starting point.

## Linux deployment with Ansible

The deployment is managed exclusively through Ansible. The playbooks support Debian 12, Ubuntu 22.04/24.04, and Fedora 40/41/42/44 targets. The controller needs `ansible-playbook`, `ansible-vault`, `ansible-galaxy`, and OpenSSL. Public deployments also need working DNS and inbound TCP 80; configure TLS before accepting real credentials.

### 1. Prepare the controller

Run the interactive preparation script from the repository root:

```bash
./scripts/setup-ansible.sh
```

It asks independently how Ansible should connect (locally or over SSH) and whether the resulting website should be restricted to the target machine. Thus, a local connection can still produce a network-accessible deployment. For remote connections it also asks for the SSH user; for network-accessible deployments it asks for the public domain or reachable IP and firewall ports. It then prompts without echo for:

- MongoDB application and bootstrap-management passwords;
- a JWT signing secret (or permission to generate a strong one);
- administrator email and password; and
- a new Ansible Vault password.

The script writes the ignored local inventory and non-secret group variables, encrypts all credentials directly into `ansible/group_vars/mern_basic.vault.yml`, installs the required Ansible collections, displays the parsed inventory, and runs the site playbook's syntax check. Existing generated files are timestamped and backed up before replacement. Plaintext secrets and the Vault password are held only in a permission-restricted temporary directory that is deleted on exit.

The generated, Git-ignored files are:

| File | Purpose |
| --- | --- |
| `ansible/inventory/hosts.yml` | Local or remote target hosts and connection settings. |
| `ansible/group_vars/mern_basic.yml` | Domain, firewall, and database names; no secrets. |
| `ansible/group_vars/mern_basic.vault.yml` | Ansible Vault-encrypted deployment credentials. |

Keep the Vault password in a password manager. It cannot be recovered from the encrypted file. Never commit generated configuration, backups, passwords, or decrypted Vault content.

### 2. Provision or rebuild

Use the deployment proxy rather than spelling out playbook paths and Vault arguments:

```bash
./scripts/ansible-deploy.sh setup
```

`setup` runs `ansible/site.yml`, prompts for the Vault password, and provisions the complete host: Node.js, loopback-only authenticated MongoDB, the application, firewall, Nginx, and systemd services. For a local deployment, the proxy also detects whether passwordless sudo is unavailable and prompts for the sudo password automatically. If a remote account requires a sudo password, pass the normal Ansible option:

```bash
./scripts/ansible-deploy.sh setup --ask-become-pass
```

After a successful initial setup, publish application changes without reconfiguring the whole machine:

```bash
./scripts/ansible-deploy.sh rebuild
```

`rebuild` runs `ansible/rebuild.yml`. It preserves deployed environment files and their secrets, while reconciling `CLIENT_ORIGIN` and `REFRESH_COOKIE_SECURE` with the bundled HTTP Nginx site. It then installs lockfile-pinned dependencies, rebuilds the React bundle, restores runtime permissions, restarts the API, and checks the frontend and API through Nginx. Any additional arguments are forwarded to `ansible-playbook`, so options such as `--limit host_1`, `--check`, or `--diff` remain available.

### Deployment behavior and operations

The API listens on `127.0.0.1:5000`; MongoDB remains loopback-only; Nginx serves the static React build and proxies `/api/`. Network exposure is independent of Ansible's connection method: a restricted deployment binds Nginx to localhost and opens no HTTP firewall rule, while a network-accessible deployment listens on all host interfaces and allows the declared HTTP port. For remote targets, the preparation script defaults the domain to the first target; for a local connection, it defaults to the machine's fully qualified hostname. Cloud firewalls, routing, and DNS remain the operator's responsibility.

The bundled Nginx configuration serves HTTP only, so Ansible writes an `http://` `CLIENT_ORIGIN` and `REFRESH_COOKIE_SECURE=false`; this lets browsers return the HTTP-only refresh-session cookie after a reload. If TLS is added externally, update the deployed `backend/.env` to the public `https://` origin and set `REFRESH_COOKIE_SECURE=true`. Outside Ansible, the backend infers secure cookies only when every comma-separated `CLIENT_ORIGIN` is HTTPS, and the optional override should normally be used only when TLS termination makes that inference inaccurate.

The enabled `mern-basic.target` groups the runtime stack. Common diagnostics are:

```bash
sudo systemctl status mern-basic.target mern-template-api nginx mongod
sudo journalctl -u mern-template-api -n 100 --no-pager
sudo tail -n 100 /var/log/nginx/error.log
```

Application startup provisions the vaulted administrator and initializes MongoDB collections and indexes. The full setup playbook validates secret lengths, supported host releases, service health, frontend availability, and the `/api/v1/health` endpoint before completing. MongoDB 8.0 currently requires a compatible target kernel; host package or daemon failures stop provisioning before the application is declared ready.
