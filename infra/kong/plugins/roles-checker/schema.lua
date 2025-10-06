local typedefs = require "kong.db.schema.typedefs"

return {
  name = "role-checker",
  fields = {
    { consumer = typedefs.no_consumer },
    { config = {
        type = "record",
        fields = {
          {
            required_roles = {
              type = "array",
              elements = { type = "string" },
              required = true,
            },
          },
        },
      },
    },
  },
}
