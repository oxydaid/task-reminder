package users

import (
	"database/sql"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"task-reminder/backend/internal/auth"
	"task-reminder/backend/internal/database"
	"task-reminder/backend/internal/utils"
)

type UserItem struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	WhatsAppNumber string `json:"whatsapp_number"`
	Role           string `json:"role"`
	IsActive       bool   `json:"is_active"`
	TaskCount      int    `json:"task_count"`
	CourseCount    int    `json:"course_count"`
	CreatedAt      string `json:"created_at"`
	UpdatedAt      string `json:"updated_at"`
}

type CreateUserRequest struct {
	Name           string `json:"name"`
	WhatsAppNumber string `json:"whatsapp_number"`
	Password       string `json:"password"`
	Role           string `json:"role"`
	IsActive       *bool  `json:"is_active"`
}

type UpdateUserRequest struct {
	Name           string  `json:"name"`
	WhatsAppNumber string  `json:"whatsapp_number"`
	Password       *string `json:"password,omitempty"`
	Role           string  `json:"role"`
	IsActive       *bool   `json:"is_active"`
}

type Handler struct {
	db *database.DB
}

func NewHandler(db *database.DB) *Handler {
	return &Handler{db: db}
}

func (h *Handler) List(c *fiber.Ctx) error {
	search := strings.TrimSpace(c.Query("q"))
	query := `
		SELECT u.id, u.name, u.whatsapp_number, u.role, u.is_active, u.created_at, u.updated_at,
		       (SELECT COUNT(*) FROM tasks t WHERE t.user_id = u.id) as task_count,
		       (SELECT COUNT(*) FROM courses cr WHERE cr.user_id = u.id) as course_count
		FROM users u
	`
	args := []interface{}{}
	if search != "" {
		query += " WHERE u.name LIKE ? OR u.whatsapp_number LIKE ?"
		args = append(args, "%"+search+"%", "%"+search+"%")
	}
	query += " ORDER BY u.created_at DESC"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal mengambil daftar pengguna"},
		})
	}
	defer rows.Close()

	list := make([]UserItem, 0)
	for rows.Next() {
		var u UserItem
		var activeInt int
		if err := rows.Scan(&u.ID, &u.Name, &u.WhatsAppNumber, &u.Role, &activeInt, &u.CreatedAt, &u.UpdatedAt, &u.TaskCount, &u.CourseCount); err == nil {
			u.IsActive = activeInt == 1
			list = append(list, u)
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    list,
	})
}

func (h *Handler) GetByID(c *fiber.Ctx) error {
	id := c.Params("id")

	var u UserItem
	var activeInt int
	err := h.db.QueryRow(`
		SELECT u.id, u.name, u.whatsapp_number, u.role, u.is_active, u.created_at, u.updated_at,
		       (SELECT COUNT(*) FROM tasks t WHERE t.user_id = u.id) as task_count,
		       (SELECT COUNT(*) FROM courses cr WHERE cr.user_id = u.id) as course_count
		FROM users u
		WHERE u.id = ?
	`, id).Scan(&u.ID, &u.Name, &u.WhatsAppNumber, &u.Role, &activeInt, &u.CreatedAt, &u.UpdatedAt, &u.TaskCount, &u.CourseCount)

	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "NOT_FOUND", "message": "Pengguna tidak ditemukan"},
		})
	}

	u.IsActive = activeInt == 1
	return c.JSON(fiber.Map{
		"success": true,
		"data":    u,
	})
}

func (h *Handler) Create(c *fiber.Ctx) error {
	var req CreateUserRequest
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
			"error": fiber.Map{"code": "VALIDATION_ERROR", "message": "Nama pengguna wajib diisi"},
		})
	}

	phone, err := utils.NormalizePhoneNumber(req.WhatsAppNumber)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "VALIDATION_ERROR", "message": err.Error()},
		})
	}

	if len(req.Password) < 6 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "VALIDATION_ERROR", "message": "Password minimal 6 karakter"},
		})
	}

	role := strings.ToLower(strings.TrimSpace(req.Role))
	if role != "admin" {
		role = "user"
	}

	isActive := 1
	if req.IsActive != nil && !*req.IsActive {
		isActive = 0
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal mengenkripsi password"},
		})
	}

	id := uuid.New().String()
	now := time.Now().UTC().Format(time.RFC3339)

	tx, err := h.db.Begin()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal memproses transaksi"},
		})
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO users (id, name, whatsapp_number, password_hash, role, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, id, name, phone, string(hash), role, isActive, now, now)

	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{"code": "PHONE_EXISTS", "message": "Nomor WhatsApp sudah digunakan oleh pengguna lain"},
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal membuat pengguna"},
		})
	}

	// Insert default settings
	_, _ = tx.Exec(`INSERT INTO user_settings (user_id, timezone, reminder_enabled, default_reminder_offset_minutes, updated_at)
		VALUES (?, 'Asia/Jakarta', 1, 2880, ?)`, id, now)

	if err := tx.Commit(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal menyimpan pengguna"},
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data": UserItem{
			ID:             id,
			Name:           name,
			WhatsAppNumber: phone,
			Role:           role,
			IsActive:       isActive == 1,
			CreatedAt:      now,
			UpdatedAt:      now,
		},
	})
}

func (h *Handler) Update(c *fiber.Ctx) error {
	currentUser := c.Locals("user").(*auth.User)
	targetID := c.Params("id")

	var req UpdateUserRequest
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
			"error": fiber.Map{"code": "VALIDATION_ERROR", "message": "Nama pengguna wajib diisi"},
		})
	}

	phone, err := utils.NormalizePhoneNumber(req.WhatsAppNumber)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "VALIDATION_ERROR", "message": err.Error()},
		})
	}

	role := strings.ToLower(strings.TrimSpace(req.Role))
	if role != "admin" {
		role = "user"
	}

	// Prevent admin from deactivating or demoting themselves
	if currentUser.ID == targetID {
		if role != "admin" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{"code": "CANNOT_DEMOTE_SELF", "message": "Anda tidak dapat mencabut role admin dari diri Anda sendiri"},
			})
		}
		if req.IsActive != nil && !*req.IsActive {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{"code": "CANNOT_DEACTIVATE_SELF", "message": "Anda tidak dapat menonaktifkan akun Anda sendiri"},
			})
		}
	}

	isActive := 1
	if req.IsActive != nil && !*req.IsActive {
		isActive = 0
	}

	now := time.Now().UTC().Format(time.RFC3339)

	var res sql.Result
	if req.Password != nil && len(*req.Password) >= 6 {
		hash, err := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal mengenkripsi password"},
			})
		}
		res, err = h.db.Exec(`
			UPDATE users
			SET name = ?, whatsapp_number = ?, password_hash = ?, role = ?, is_active = ?, updated_at = ?
			WHERE id = ?
		`, name, phone, string(hash), role, isActive, now, targetID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal memperbarui pengguna: " + err.Error()},
			})
		}
	} else {
		res, err = h.db.Exec(`
			UPDATE users
			SET name = ?, whatsapp_number = ?, role = ?, is_active = ?, updated_at = ?
			WHERE id = ?
		`, name, phone, role, isActive, now, targetID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal memperbarui pengguna: " + err.Error()},
			})
		}
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "NOT_FOUND", "message": "Pengguna tidak ditemukan"},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Pengguna berhasil diperbarui",
	})
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	currentUser := c.Locals("user").(*auth.User)
	targetID := c.Params("id")

	if currentUser.ID == targetID {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "CANNOT_DELETE_SELF", "message": "Anda tidak dapat menghapus akun Anda sendiri"},
		})
	}

	res, err := h.db.Exec("DELETE FROM users WHERE id = ?", targetID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal menghapus pengguna"},
		})
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "NOT_FOUND", "message": "Pengguna tidak ditemukan"},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Pengguna berhasil dihapus",
	})
}
