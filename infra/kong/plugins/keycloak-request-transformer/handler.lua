local kong = kong
local cjson = require "cjson"
local KeycloakRequestTransformer = {
  PRIORITY = 800,
  VERSION = "1.2",
}

function KeycloakRequestTransformer:access(config)
  local body = kong.request.get_raw_body()
  local json_body = cjson.decode(body)
  if not json_body then
    return kong.response.exit(400, { message = "Invalid JSON body" })
  end
  local form_data = ""

  if config.type == "login" then
    form_data = string.format(
      "username=%s&password=%s&client_id=%s&grant_type=password&client_secret=%s&scope=openid",
      ngx.escape_uri(json_body.username or ""),
      ngx.escape_uri(json_body.password or ""),
      config.client_id,
      config.client_secret
    )

  elseif config.type == "refresh_token" then
    form_data = string.format(
      "token=%s&client_id=%s&grant_type=refresh_token&client_secret=%s",
      ngx.escape_uri(json_body.token or ""),
      config.client_id,
      config.client_secret
    )

  elseif config.type == "logout" then
    form_data = string.format(
      "token=%s&client_id=%s&client_secret=%s&token_type_hint=refresh_token",
      ngx.escape_uri(json_body.token or ""),
      config.client_id,
      config.client_secret
    )
  end

  kong.service.request.set_raw_body(form_data)
  kong.service.request.set_header("Content-Type", "application/x-www-form-urlencoded")
  kong.service.request.set_header("Content-Length", string.len(form_data))
end

return KeycloakRequestTransformer