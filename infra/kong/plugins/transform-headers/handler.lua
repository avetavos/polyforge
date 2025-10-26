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
    local isAdministrator = false
    for _, role in ipairs(claims.realm_access.roles) do
      if role == "administrator" then
        isAdministrator = true
        break
      end
    end

    if isAdministrator then
      kong.service.request.set_header("X-User-Role", "administrator")
      return
    else
      kong.service.request.set_header("X-User-Role", "customer")
      return
    end
  end
end

return TransformHeaders