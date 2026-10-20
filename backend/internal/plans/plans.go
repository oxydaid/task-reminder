package plans

import (
	"database/sql"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"task-reminder/backend/internal/database"
)

type Plan struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Slug          string `json:"slug"`
	Description   string `json:"description"`
	Price         int    `json:"price"`
	BillingPeriod string `json:"billing_period"`
	CourseLimit   int    `json:"course_limit"`
	TaskLimit     int    `json:"task_limit"`
	IsActive      bool   `json:"is_active"`
	CreatedAt     string `json:"created_at"`
	UpdatedAt     string `json:"updated_at"`
}

type PlanRequest struct {
	Name          string `json:"name"`
	Slug          string `json:"slug"`
	Description   string `json:"description"`
	Price         int    `json:"price"`
	BillingPeriod string `json:"billing_period"`
	CourseLimit   int    `json:"course_limit"`
	TaskLimit     int    `json:"task_limit"`
	IsActive      *bool  `json:"is_active"`
}

type Handler struct {
	db *database.DB
}

func NewHandler(db *database.DB) *Handler {
	return &Handler{db: db}
}

// ListPublic returns active plans for public pricing page
func (h *Handler) ListPublic(c *fiber.Ctx) error {
	rows, err := h.db.Query(`
		SELECT id, name, slug, description, price, billing_period, course_limit, task_limit, is_active, created_at, updated_at
		FROM plans
		WHERE is_active = 1
		ORDER BY price ASC
	`)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal mengambil daftar paket"},
		})
	}
	defer rows.Close()

	list := make([]Plan, 0)
	for rows.Next() {
		var p Plan
		var desc sql.NullString
		var activeInt int
		if err := rows.Scan(&p.ID, &p.Name, &p.Slug, &desc, &p.Price, &p.BillingPeriod, &p.CourseLimit, &p.TaskLimit, &activeInt, &p.CreatedAt, &p.UpdatedAt); err == nil {
			p.Description = desc.String
			p.IsActive = activeInt == 1
			list = append(list, p)
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    list,
	})
}

// ListAdmin returns all plans for admin
func (h *Handler) ListAdmin(c *fiber.Ctx) error {
	rows, err := h.db.Query(`
		SELECT id, name, slug, description, price, billing_period, course_limit, task_limit, is_active, created_at, updated_at
		FROM plans
		ORDER BY price ASC
	`)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal mengambil data paket"},
		})
	}
	defer rows.Close()

	list := make([]Plan, 0)
	for rows.Next() {
		var p Plan
		var desc sql.NullString
		var activeInt int
		if err := rows.Scan(&p.ID, &p.Name, &p.Slug, &desc, &p.Price, &p.BillingPeriod, &p.CourseLimit, &p.TaskLimit, &activeInt, &p.CreatedAt, &p.UpdatedAt); err == nil {
			p.Description = desc.String
			p.IsActive = activeInt == 1
			list = append(list, p)
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    list,
	})
}

func (h *Handler) Create(c *fiber.Ctx) error {
	var req PlanRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "INVALID_BODY", "message": "Format data tidak valid"},
		})
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "VALIDATION_ERROR", "message": "Nama paket wajib diisi"},
		})
	}

	slug := strings.ToLower(strings.TrimSpace(req.Slug))
	if slug == "" {
		slug = strings.ReplaceAll(strings.ToLower(name), " ", "-")
	}

	period := strings.TrimSpace(req.BillingPeriod)
	if period == "" {
		period = "monthly"
	}

	isActive := 1
	if req.IsActive != nil && !*req.IsActive {
		isActive = 0
	}

	id := uuid.New().String()
	now := time.Now().UTC().Format(time.RFC3339)

	_, err := h.db.Exec(`
		INSERT INTO plans (id, name, slug, description, price, billing_period, course_limit, task_limit, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, name, slug, strings.TrimSpace(req.Description), req.Price, period, req.CourseLimit, req.TaskLimit, isActive, now, now)

	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{"code": "SLUG_EXISTS", "message": "Slug paket sudah digunakan"},
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal membuat paket"},
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data": Plan{
			ID:            id,
			Name:          name,
			Slug:          slug,
			Description:   strings.TrimSpace(req.Description),
			Price:         req.Price,
			BillingPeriod: period,
			CourseLimit:   req.CourseLimit,
			TaskLimit:     req.TaskLimit,
			IsActive:      isActive == 1,
			CreatedAt:     now,
			UpdatedAt:     now,
		},
	})
}

func (h *Handler) Update(c *fiber.Ctx) error {
	id := c.Params("id")

	var req PlanRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "INVALID_BODY", "message": "Format data tidak valid"},
		})
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "VALIDATION_ERROR", "message": "Nama paket wajib diisi"},
		})
	}

	slug := strings.ToLower(strings.TrimSpace(req.Slug))
	period := strings.TrimSpace(req.BillingPeriod)
	if period == "" {
		period = "monthly"
	}

	isActive := 1
	if req.IsActive != nil && !*req.IsActive {
		isActive = 0
	}

	now := time.Now().UTC().Format(time.RFC3339)

	res, err := h.db.Exec(`
		UPDATE plans
		SET name = ?, slug = ?, description = ?, price = ?, billing_period = ?, course_limit = ?, task_limit = ?, is_active = ?, updated_at = ?
		WHERE id = ?
	`, name, slug, strings.TrimSpace(req.Description), req.Price, period, req.CourseLimit, req.TaskLimit, isActive, now, id)

	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{"code": "SLUG_EXISTS", "message": "Slug paket sudah digunakan"},
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal memperbarui paket"},
		})
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "NOT_FOUND", "message": "Paket tidak ditemukan"},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Paket berhasil diperbarui",
	})
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	id := c.Params("id")

	res, err := h.db.Exec("DELETE FROM plans WHERE id = ?", id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal menghapus paket"},
		})
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "NOT_FOUND", "message": "Paket tidak ditemukan"},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Paket berhasil dihapus",
	})
}
