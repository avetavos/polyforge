local kong = kong
local cjson = require "cjson"
local RoleChecker = {
  PRIORITY = 1050,
  VERSION = "1.0",
}

function RoleChecker:access(config)
  local token = kong.request.get_header("authorization")

  -- Strip "Bearer "
  token = token:gsub("Bearer%s+", "")

  -- Decode JWT payload only (naive base64 decode, assuming already verified by OIDC/JWT plugin)
  local header, payload, signature = token:match("([^%.]+)%.([^%.]+)%.([^%.]+)")
  local decoded = ngx.decode_base64(payload)
  local ok, claims = pcall(cjson.decode, decoded)
  if not ok then
    return kong.response.exit(401, { message = "Invalid token payload" })
  end

  -- Extract roles (adjust to your Keycloak claim structure)
  local user_roles = {}
  if claims.realm_access and claims.realm_access.roles then
    user_roles = claims.realm_access.roles
  end

  -- Check if at least one required role exists
  for _, required_role in ipairs(config.required_roles) do
    for _, user_role in ipairs(user_roles) do
      if user_role == required_role then
          -- Set user id info headers
          if claims.sub then
            kong.service.request.set_header("X-User-Id", claims.sub)
          end
        return  -- allow request
      end
    end
  end

  return kong.response.exit(403, { message = "Forbidden: missing required role" })
end

return RoleChecker
