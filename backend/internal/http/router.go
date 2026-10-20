package http

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"task-reminder/backend/internal/auth"
	"task-reminder/backend/internal/courses"
	"task-reminder/backend/internal/database"
	"task-reminder/backend/internal/plans"
	"task-reminder/backend/internal/reminders"
	"task-reminder/backend/internal/settings"
	"task-reminder/backend/internal/tasks"
	"task-reminder/backend/internal/users"
	"task-reminder/backend/internal/whatsapp"
)

type Config struct {
	DB        *database.DB
	AuthSvc   *auth.Service
	WASvc     *whatsapp.Service
	Scheduler *reminders.Scheduler
	AllowedOrigins string
}

func SetupRouter(cfg Config) *fiber.App {
	app := fiber.New(fiber.Config{
		AppName:      "Task Reminder API v1",
		ErrorHandler: customErrorHandler,
	})

	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "[${time}] ${status} - ${latency} ${method} ${path}\n",
	}))

	allowedOrigins := cfg.AllowedOrigins
	if allowedOrigins == "" {
		allowedOrigins = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001"
	}

	app.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, X-Requested-With",
		AllowMethods:     "GET, POST, HEAD, PUT, DELETE, PATCH, OPTIONS",
		AllowCredentials: true,
	}))

	// Health check
	healthHandler := func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "healthy",
			"time":    fiber.Map{"utc": c.Context().Time().UTC()},
			"version": "1.0.0",
		})
	}
	app.Get("/health", healthHandler)
	app.Get("/api/v1/health", healthHandler)

	// Handlers
	courseHandler := courses.NewHandler(cfg.DB)
	taskHandler := tasks.NewHandler(cfg.DB)
	settingsHandler := settings.NewHandler(cfg.DB)
	plansHandler := plans.NewHandler(cfg.DB)
	usersHandler := users.NewHandler(cfg.DB)
	waHandler := whatsapp.NewHandler(cfg.WASvc)
	reminderHandler := reminders.NewHandler(cfg.DB)

	api := app.Group("/api/v1")

	// Public routes
	api.Get("/plans", plansHandler.ListPublic)

	// Auth routes
	authGroup := api.Group("/auth")
	authGroup.Post("/register", func(c *fiber.Ctx) error {
		var req auth.RegisterRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{"code": "INVALID_BODY", "message": "Format data tidak valid"},
			})
		}
		user, token, err := cfg.AuthSvc.Register(req)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{"code": "REGISTER_FAILED", "message": err.Error()},
			})
		}
		auth.SetSessionCookie(c, token)
		return c.Status(fiber.StatusCreated).JSON(fiber.Map{
			"success": true,
			"data": fiber.Map{
				"user":  user,
				"token": token,
			},
		})
	})

	authGroup.Post("/login", func(c *fiber.Ctx) error {
		var req auth.LoginRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{"code": "INVALID_BODY", "message": "Format data tidak valid"},
			})
		}
		user, token, err := cfg.AuthSvc.Login(req)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{"code": "LOGIN_FAILED", "message": err.Error()},
			})
		}
		auth.SetSessionCookie(c, token)
		return c.JSON(fiber.Map{
			"success": true,
			"data": fiber.Map{
				"user":  user,
				"token": token,
			},
		})
	})

	authGroup.Post("/logout", func(c *fiber.Ctx) error {
		token := c.Cookies("session_id")
		if token == "" {
			h := c.Get("Authorization")
			if strings.HasPrefix(h, "Bearer ") {
				token = strings.TrimPrefix(h, "Bearer ")
			}
		}
		_ = cfg.AuthSvc.DeleteSession(token)
		auth.ClearSessionCookie(c)
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Berhasil logout",
		})
	})

	// Protected user routes
	userProtected := api.Group("", cfg.AuthSvc.AuthRequired())

	userProtected.Get("/auth/me", func(c *fiber.Ctx) error {
		user := c.Locals("user").(*auth.User)
		return c.JSON(fiber.Map{
			"success": true,
			"data":    user,
		})
	})

	userProtected.Post("/auth/change-password", func(c *fiber.Ctx) error {
		user := c.Locals("user").(*auth.User)
		var req auth.ChangePasswordRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{"code": "INVALID_BODY", "message": "Format data tidak valid"},
			})
		}
		if err := cfg.AuthSvc.ChangePassword(user.ID, req.CurrentPassword, req.NewPassword); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{"code": "PASSWORD_CHANGE_FAILED", "message": err.Error()},
			})
		}
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Password berhasil diperbarui",
		})
	})

	// Courses
	userProtected.Get("/courses", courseHandler.List)
	userProtected.Post("/courses", courseHandler.Create)
	userProtected.Get("/courses/:id", courseHandler.GetByID)
	userProtected.Put("/courses/:id", courseHandler.Update)
	userProtected.Delete("/courses/:id", courseHandler.Delete)

	// Tasks
	userProtected.Get("/tasks", taskHandler.List)
	userProtected.Post("/tasks", taskHandler.Create)
	userProtected.Get("/tasks/:id", taskHandler.GetByID)
	userProtected.Put("/tasks/:id", taskHandler.Update)
	userProtected.Delete("/tasks/:id", taskHandler.Delete)
	userProtected.Patch("/tasks/:id/complete", taskHandler.ToggleComplete)

	// Dashboard
	userProtected.Get("/dashboard/summary", taskHandler.DashboardSummary)

	// Settings
	userProtected.Get("/settings", settingsHandler.Get)
	userProtected.Put("/settings", settingsHandler.Update)

	// Notifications / reminder logs
	userProtected.Get("/notifications", reminderHandler.List)

	// Admin routes
	adminProtected := api.Group("/admin", cfg.AuthSvc.AuthRequired(), auth.AdminRequired())

	// Admin WhatsApp
	adminProtected.Get("/whatsapp/status", waHandler.GetStatus)
	adminProtected.Post("/whatsapp/pair", waHandler.Pair)
	adminProtected.Post("/whatsapp/logout", waHandler.Logout)

	// Admin Users
	adminProtected.Get("/users", usersHandler.List)
	adminProtected.Post("/users", usersHandler.Create)
	adminProtected.Get("/users/:id", usersHandler.GetByID)
	adminProtected.Put("/users/:id", usersHandler.Update)
	adminProtected.Delete("/users/:id", usersHandler.Delete)

	// Admin Plans
	adminProtected.Get("/plans", plansHandler.ListAdmin)
	adminProtected.Post("/plans", plansHandler.Create)
	adminProtected.Put("/plans/:id", plansHandler.Update)
	adminProtected.Delete("/plans/:id", plansHandler.Delete)

	return app
}

func customErrorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}

	return c.Status(code).JSON(fiber.Map{
		"success": false,
		"error": fiber.Map{
			"code":    "ERROR",
			"message": err.Error(),
		},
	})
}
