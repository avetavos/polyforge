#!/bin/bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Keycloak migration: provisions the `polyforge` realm, roles, confidential
# client, and seed users (2 administrators + 5 customers).
#
# Idempotent: safe to run repeatedly. Existing realm/roles/client/users are
# detected and skipped; only missing objects are created.
#
# Config is read from the environment (falling back to infra/.env), so the
# same script works locally and inside the compose network. Override any of
# the variables below to point at a different Keycloak / change credentials.
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load infra/.env if present (does not override variables already exported).
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/../.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# --- Configuration (env-overridable) ---------------------------------------
KEYCLOAK_PORT="${KEYCLOAK_PORT:-8080}"
KC_URL="${KC_URL:-http://localhost:${KEYCLOAK_PORT}}"
ADMIN_USER="${KEYCLOAK_ADMIN_USER:-admin}"
ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin_password}"

REALM="${REALM:-polyforge}"
CLIENT_ID="${CLIENT_ID:-polyforge}"
# Must match the client_secret in infra/kong/kong.yml.
CLIENT_SECRET="${KC_CLIENT_SECRET:-DE4hxSxAX36JJaGz4uuls765EUcwLNiS}"

# Seed users: counts + shared passwords (override for non-dev environments).
ADMIN_COUNT="${ADMIN_COUNT:-2}"
CUSTOMER_COUNT="${CUSTOMER_COUNT:-5}"
ADMIN_USER_PASSWORD="${ADMIN_USER_PASSWORD:-admin_password}"
CUSTOMER_USER_PASSWORD="${CUSTOMER_USER_PASSWORD:-customer_password}"

# Realm roles consumed by Kong's roles-checker plugin (see kong/kong.yml).
ROLES=(customer administrator)

WAIT_RETRIES="${WAIT_RETRIES:-30}"
WAIT_DELAY="${WAIT_DELAY:-2}"

TOKEN=""

# --- Helpers ---------------------------------------------------------------

fetch_token() {
  curl -s -X POST "$KC_URL/realms/master/protocol/openid-connect/token" \
    -d 'client_id=admin-cli' \
    -d "username=$ADMIN_USER" \
    -d "password=$ADMIN_PASSWORD" \
    -d 'grant_type=password' | jq -r '.access_token // empty'
}

wait_for_keycloak() {
  echo "⏳ Waiting for Keycloak admin API at $KC_URL ..."
  local i
  for ((i = 1; i <= WAIT_RETRIES; i++)); do
    TOKEN="$(fetch_token || true)"
    if [[ -n "$TOKEN" ]]; then
      echo "✅ Keycloak is ready (admin authenticated)."
      return 0
    fi
    echo "   attempt $i/$WAIT_RETRIES failed; retrying in ${WAIT_DELAY}s..."
    sleep "$WAIT_DELAY"
  done
  echo "❌ Keycloak did not become ready in time." >&2
  exit 1
}

# curl wrapper that injects the admin bearer token. Echoes the HTTP status on
# the last line so callers can branch on it.
api() { # METHOD PATH [JSON_BODY]
  local method="$1" path="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -s -o /dev/null -w '%{http_code}' -X "$method" "$KC_URL/admin/realms$path" \
      -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "$body"
  else
    curl -s -o /dev/null -w '%{http_code}' -X "$method" "$KC_URL/admin/realms$path" \
      -H "Authorization: Bearer $TOKEN"
  fi
}

api_get() { # PATH  -> response body
  curl -s "$KC_URL/admin/realms$1" -H "Authorization: Bearer $TOKEN"
}

# --- Provisioning steps ----------------------------------------------------

ensure_realm() {
  # /admin/realms/{realm} returns 404 when the realm is absent.
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' "$KC_URL/admin/realms/$REALM" \
    -H "Authorization: Bearer $TOKEN")"
  if [[ "$code" == "200" ]]; then
    echo "• realm '$REALM' already exists"
  else
    code="$(api POST '' "{\"realm\":\"$REALM\",\"enabled\":true}")"
    echo "• created realm '$REALM' (HTTP $code)"
  fi
}

ensure_role() { # ROLE_NAME
  local role="$1" code
  code="$(curl -s -o /dev/null -w '%{http_code}' "$KC_URL/admin/realms/$REALM/roles/$role" \
    -H "Authorization: Bearer $TOKEN")"
  if [[ "$code" == "200" ]]; then
    echo "• role '$role' already exists"
  else
    code="$(api POST "/$REALM/roles" "{\"name\":\"$role\"}")"
    echo "• created role '$role' (HTTP $code)"
  fi
}

ensure_client() {
  local existing
  existing="$(api_get "/$REALM/clients?clientId=$CLIENT_ID" | jq -r '.[0].id // empty')"
  if [[ -n "$existing" ]]; then
    echo "• client '$CLIENT_ID' already exists"
    return
  fi
  local payload
  payload=$(cat <<JSON
{
  "clientId": "$CLIENT_ID",
  "enabled": true,
  "protocol": "openid-connect",
  "publicClient": false,
  "clientAuthenticatorType": "client-secret",
  "secret": "$CLIENT_SECRET",
  "directAccessGrantsEnabled": true,
  "standardFlowEnabled": true,
  "serviceAccountsEnabled": false,
  "fullScopeAllowed": true
}
JSON
)
  local code
  code="$(api POST "/$REALM/clients" "$payload")"
  echo "• created client '$CLIENT_ID' (HTTP $code)"
}

ensure_user() { # USERNAME PASSWORD ROLE
  local username="$1" password="$2" role="$3"
  local existing
  existing="$(api_get "/$REALM/users?username=$username&exact=true" | jq -r '.[0].id // empty')"
  if [[ -n "$existing" ]]; then
    echo "• user '$username' already exists"
  else
    local payload
    payload=$(cat <<JSON
{
  "username": "$username",
  "enabled": true,
  "emailVerified": true,
  "firstName": "$username",
  "lastName": "user",
  "email": "$username@polyforge.local",
  "requiredActions": [],
  "credentials": [{"type": "password", "value": "$password", "temporary": false}]
}
JSON
)
    local code
    code="$(api POST "/$REALM/users" "$payload")"
    echo "• created user '$username' (HTTP $code)"
  fi

  # Ensure the realm role mapping is present (idempotent — Keycloak ignores
  # a role that is already assigned).
  local user_id role_json code
  user_id="$(api_get "/$REALM/users?username=$username&exact=true" | jq -r '.[0].id')"
  role_json="$(api_get "/$REALM/roles/$role")"
  code="$(api POST "/$REALM/users/$user_id/role-mappings/realm" "[$role_json]")"
  echo "    ↳ role '$role' assigned (HTTP $code)"
}

# --- Main ------------------------------------------------------------------

echo "🔄 Keycloak migration starting (realm='$REALM', url='$KC_URL')"
wait_for_keycloak

ensure_realm
for r in "${ROLES[@]}"; do ensure_role "$r"; done
ensure_client

echo "👤 Seeding $ADMIN_COUNT administrator(s) and $CUSTOMER_COUNT customer(s)..."
for ((n = 1; n <= ADMIN_COUNT; n++)); do
  ensure_user "admin_$n" "$ADMIN_USER_PASSWORD" administrator
done
for ((n = 1; n <= CUSTOMER_COUNT; n++)); do
  ensure_user "customer_$n" "$CUSTOMER_USER_PASSWORD" customer
done

echo "✅ Keycloak migration complete."
