local typedefs = require "kong.db.schema.typedefs"

return {
  name = "transform-headers",
  fields = {
    { consumer = typedefs.no_consumer },
  },
}