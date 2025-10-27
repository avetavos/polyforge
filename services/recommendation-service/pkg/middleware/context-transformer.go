package middleware

import (
	"github.com/gofiber/fiber/v2"
)

func ContextTransformer(c *fiber.Ctx) error {
	xUserID := c.Get("x-user-id")
	xUserRole := c.Get("x-user-role")

	c.Locals("userID", xUserID)
	c.Locals("userRole", xUserRole)

	return c.Next()
}
