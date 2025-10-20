local kong = kong
local cjson = require "cjson"
local RoleChecker = {
  PRIORITY = 950,
  VERSION = "1.2",
}

function RoleChecker:access(config)
  local token = kong.request.get_header("authorization")

  token = token:gsub("Bearer%s+", "")

  local header, payload, signature = token:match("([^%.]+)%.([^%.]+)%.([^%.]+)")
  local decoded = ngx.decode_base64(payload)
  local ok, claims = pcall(cjson.decode, decoded)
  if not ok then
    return kong.response.exit(401, { message = "Invalid token payload" })
  end

  local current_time = ngx.time()
  if claims.exp and current_time >= claims.exp then
    return kong.response.exit(401, { message = "Token has expired" })
  end

  local user_roles = {}
  if claims.realm_access and claims.realm_access.roles then
    user_roles = claims.realm_access.roles
  end

  for _, required_role in ipairs(config.required_roles) do
    for _, user_role in ipairs(user_roles) do
      if user_role == required_role then
        return 
      end
    end
  end

  return kong.response.exit(403, { message = "Forbidden: missing required role" })
end

return RoleChecker
