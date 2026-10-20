package courses

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"task-reminder/backend/internal/auth"
	"task-reminder/backend/internal/database"
)

type Course struct {
	ID        string `json:"id"`
	UserID    string `json:"user_id"`
	Name      string `json:"name"`
	Code      string `json:"code"`
	Lecturer  string `json:"lecturer"`
	Color     string `json:"color"`
	TaskCount int    `json:"task_count"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

type CreateCourseRequest struct {
	Name     string `json:"name"`
	Code     string `json:"code"`
	Lecturer string `json:"lecturer"`
	Color    string `json:"color"`
}

type Handler struct {
	db *database.DB
}

func NewHandler(db *database.DB) *Handler {
	return &Handler{db: db}
}

func (h *Handler) List(c *fiber.Ctx) error {
	user := c.Locals("user").(*auth.User)

	rows, err := h.db.Query(`
		SELECT c.id, c.user_id, c.name, c.code, c.lecturer, c.color, c.created_at, c.updated_at,
		       (SELECT COUNT(*) FROM tasks t WHERE t.course_id = c.id) as task_count
		FROM courses c
		WHERE c.user_id = ?
		ORDER BY c.created_at DESC
	`, user.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal mengambil daftar mata kuliah"},
		})
	}
	defer rows.Close()

	courses := make([]Course, 0)
	for rows.Next() {
		var cr Course
		var code, lecturer, color sql.NullString
		if err := rows.Scan(&cr.ID, &cr.UserID, &cr.Name, &code, &lecturer, &color, &cr.CreatedAt, &cr.UpdatedAt, &cr.TaskCount); err != nil {
			continue
		}
		cr.Code = code.String
		cr.Lecturer = lecturer.String
		cr.Color = color.String
		if cr.Color == "" {
			cr.Color = "#6366F1"
		}
		courses = append(courses, cr)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    courses,
	})
}

func (h *Handler) GetByID(c *fiber.Ctx) error {
	user := c.Locals("user").(*auth.User)
	id := c.Params("id")

	var cr Course
	var code, lecturer, color sql.NullString
	err := h.db.QueryRow(`
		SELECT c.id, c.user_id, c.name, c.code, c.lecturer, c.color, c.created_at, c.updated_at,
		       (SELECT COUNT(*) FROM tasks t WHERE t.course_id = c.id) as task_count
		FROM courses c
		WHERE c.id = ? AND c.user_id = ?
	`, id, user.ID).Scan(&cr.ID, &cr.UserID, &cr.Name, &code, &lecturer, &color, &cr.CreatedAt, &cr.UpdatedAt, &cr.TaskCount)

	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "NOT_FOUND", "message": "Mata kuliah tidak ditemukan"},
		})
	}

	cr.Code = code.String
	cr.Lecturer = lecturer.String
	cr.Color = color.String
	if cr.Color == "" {
		cr.Color = "#6366F1"
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    cr,
	})
}

func (h *Handler) Create(c *fiber.Ctx) error {
	user := c.Locals("user").(*auth.User)

	var req CreateCourseRequest
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
			"error": fiber.Map{"code": "VALIDATION_ERROR", "message": "Nama mata kuliah wajib diisi"},
		})
	}

	color := strings.TrimSpace(req.Color)
	if color == "" {
		color = "#6366F1"
	}

	id := uuid.New().String()
	now := time.Now().UTC().Format(time.RFC3339)

	_, err := h.db.Exec(`
		INSERT INTO courses (id, user_id, name, code, lecturer, color, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, id, user.ID, name, strings.TrimSpace(req.Code), strings.TrimSpace(req.Lecturer), color, now, now)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal membuat mata kuliah"},
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data": Course{
			ID:        id,
			UserID:    user.ID,
			Name:      name,
			Code:      strings.TrimSpace(req.Code),
			Lecturer:  strings.TrimSpace(req.Lecturer),
			Color:     color,
			TaskCount: 0,
			CreatedAt: now,
			UpdatedAt: now,
		},
	})
}

func (h *Handler) Update(c *fiber.Ctx) error {
	user := c.Locals("user").(*auth.User)
	id := c.Params("id")

	var req CreateCourseRequest
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
			"error": fiber.Map{"code": "VALIDATION_ERROR", "message": "Nama mata kuliah wajib diisi"},
		})
	}

	color := strings.TrimSpace(req.Color)
	if color == "" {
		color = "#6366F1"
	}

	now := time.Now().UTC().Format(time.RFC3339)
	res, err := h.db.Exec(`
		UPDATE courses
		SET name = ?, code = ?, lecturer = ?, color = ?, updated_at = ?
		WHERE id = ? AND user_id = ?
	`, name, strings.TrimSpace(req.Code), strings.TrimSpace(req.Lecturer), color, now, id, user.ID)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal mengubah mata kuliah"},
		})
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "NOT_FOUND", "message": "Mata kuliah tidak ditemukan"},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": Course{
			ID:        id,
			UserID:    user.ID,
			Name:      name,
			Code:      strings.TrimSpace(req.Code),
			Lecturer:  strings.TrimSpace(req.Lecturer),
			Color:     color,
			UpdatedAt: now,
		},
	})
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	user := c.Locals("user").(*auth.User)
	id := c.Params("id")
	force := c.Query("force") == "true"

	// Check if exists and count tasks
	var taskCount int
	err := h.db.QueryRow(`SELECT COUNT(*) FROM tasks WHERE course_id = ? AND user_id = ?`, id, user.ID).Scan(&taskCount)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal memeriksa tugas terkait"},
		})
	}

	if taskCount > 0 && !force {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "HAS_ATTACHED_TASKS",
				"message": "Mata kuliah masih memiliki tugas yang terhubung. Hapus atau pindahkan tugas terlebih dahulu, atau gunakan konfirmasi hapus.",
				"count":   taskCount,
			},
		})
	}

	tx, err := h.db.Begin()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal memproses penghapusan"},
		})
	}
	defer tx.Rollback()

	if taskCount > 0 && force {
		// Set course_id to NULL on tasks
		_, _ = tx.Exec(`UPDATE tasks SET course_id = NULL WHERE course_id = ? AND user_id = ?`, id, user.ID)
	}

	res, err := tx.Exec(`DELETE FROM courses WHERE id = ? AND user_id = ?`, id, user.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal menghapus mata kuliah"},
		})
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "NOT_FOUND", "message": "Mata kuliah tidak ditemukan"},
		})
	}

	if err := tx.Commit(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal menyimpan perubahan"},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Mata kuliah berhasil dihapus",
	})
}
