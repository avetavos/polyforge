local kong = kong
local cjson = require "cjson"
local TransformHeaders = {
  PRIORITY = 900,
  VERSION = "1.1",
}

function TransformHeaders:access()
  local token = kong.request.get_header("authorization")

  token = token:gsub("Bearer%s+", "")
  local header, payload, signature = token:match("([^%.]+)%.([^%.]+)%.([^%.]+)")
  local decoded = ngx.decode_base64(payload)
  local ok, claims = pcall(cjson.decode, decoded)
  if not ok then
    return kong.response.exit(401, { message = "Invalid token payload" })
  end

  if claims.sub then
    kong.service.request.set_header("X-User-Id", claims.sub)
  end

  if claims.realm_access and claims.realm_access.roles then
    kong.service.request.set_header("X-User-Roles", claims.realm_access.roles)
  end
end

return TransformHeaders