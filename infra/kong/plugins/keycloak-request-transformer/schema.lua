local typedefs = require "kong.db.schema.typedefs"

return {
  name = "keycloak-request-transformer",
  fields = {
    { consumer = typedefs.no_consumer },
    { config = {
        type = "record",
        fields = {
          {
            client_id = {
              type = "string",
              required = true,
            }
          },
          {
            client_secret = {
              type = "string",
              required = true,
            }
          },
          {
            type = {
              type = "string",
              one_of = { "login", "refresh_token", "logout" },
              required = true
            }
          },
        }
      },
    },
  },
}