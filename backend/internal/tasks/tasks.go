package tasks

import (
	"database/sql"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"task-reminder/backend/internal/auth"
	"task-reminder/backend/internal/database"
)

type Task struct {
	ID                    string  `json:"id"`
	UserID                string  `json:"user_id"`
	CourseID              *string `json:"course_id"`
	CourseName            string  `json:"course_name,omitempty"`
	CourseColor           string  `json:"course_color,omitempty"`
	Title                 string  `json:"title"`
	Description           string  `json:"description"`
	DeadlineAt            string  `json:"deadline_at"`
	Priority              string  `json:"priority"`
	Status                string  `json:"status"`
	IsOverdue             bool    `json:"is_overdue"`
	ReminderEnabled       bool    `json:"reminder_enabled"`
	ReminderOffsetMinutes int     `json:"reminder_offset_minutes"`
	CompletedAt           *string `json:"completed_at"`
	CreatedAt             string  `json:"created_at"`
	UpdatedAt             string  `json:"updated_at"`
}

type CreateTaskRequest struct {
	CourseID              *string `json:"course_id"`
	Title                 string  `json:"title"`
	Description           string  `json:"description"`
	DeadlineAt            string  `json:"deadline_at"`
	Priority              string  `json:"priority"`
	ReminderEnabled       *bool   `json:"reminder_enabled"`
	ReminderOffsetMinutes *int    `json:"reminder_offset_minutes"`
}

type UpdateTaskRequest struct {
	CourseID              *string `json:"course_id"`
	Title                 string  `json:"title"`
	Description           string  `json:"description"`
	DeadlineAt            string  `json:"deadline_at"`
	Priority              string  `json:"priority"`
	Status                *string `json:"status"`
	ReminderEnabled       *bool   `json:"reminder_enabled"`
	ReminderOffsetMinutes *int    `json:"reminder_offset_minutes"`
}

type Handler struct {
	db *database.DB
}

func NewHandler(db *database.DB) *Handler {
	return &Handler{db: db}
}

func (h *Handler) List(c *fiber.Ctx) error {
	user := c.Locals("user").(*auth.User)

	statusFilter := c.Query("status")
	courseFilter := c.Query("course_id")
	priorityFilter := c.Query("priority")

	query := `
		SELECT t.id, t.user_id, t.course_id, c.name as course_name, c.color as course_color,
		       t.title, t.description, t.deadline_at, t.priority, t.status,
		       t.reminder_enabled, t.reminder_offset_minutes, t.completed_at, t.created_at, t.updated_at
		FROM tasks t
		LEFT JOIN courses c ON t.course_id = c.id
		WHERE t.user_id = ?
	`
	args := []interface{}{user.ID}

	if statusFilter != "" {
		query += " AND t.status = ?"
		args = append(args, statusFilter)
	}
	if courseFilter != "" {
		query += " AND t.course_id = ?"
		args = append(args, courseFilter)
	}
	if priorityFilter != "" {
		query += " AND t.priority = ?"
		args = append(args, priorityFilter)
	}

	query += " ORDER BY CASE WHEN t.status = 'pending' THEN 0 ELSE 1 END, t.deadline_at ASC"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal mengambil daftar tugas"},
		})
	}
	defer rows.Close()

	now := time.Now().UTC()
	taskList := make([]Task, 0)

	for rows.Next() {
		var t Task
		var courseID, courseName, courseColor, desc, completedAt sql.NullString
		var reminderEnabledInt int

		err := rows.Scan(
			&t.ID, &t.UserID, &courseID, &courseName, &courseColor,
			&t.Title, &desc, &t.DeadlineAt, &t.Priority, &t.Status,
			&reminderEnabledInt, &t.ReminderOffsetMinutes, &completedAt, &t.CreatedAt, &t.UpdatedAt,
		)
		if err != nil {
			continue
		}

		if courseID.Valid {
			t.CourseID = &courseID.String
			t.CourseName = courseName.String
			t.CourseColor = courseColor.String
		}
		t.Description = desc.String
		t.ReminderEnabled = reminderEnabledInt == 1
		if completedAt.Valid {
			t.CompletedAt = &completedAt.String
		}

		// Calculate overdue
		if t.Status == "pending" {
			dlTime, err := time.Parse(time.RFC3339, t.DeadlineAt)
			if err == nil && dlTime.Before(now) {
				t.IsOverdue = true
			}
		}

		taskList = append(taskList, t)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    taskList,
	})
}

func (h *Handler) GetByID(c *fiber.Ctx) error {
	user := c.Locals("user").(*auth.User)
	id := c.Params("id")

	var t Task
	var courseID, courseName, courseColor, desc, completedAt sql.NullString
	var reminderEnabledInt int

	err := h.db.QueryRow(`
		SELECT t.id, t.user_id, t.course_id, c.name as course_name, c.color as course_color,
		       t.title, t.description, t.deadline_at, t.priority, t.status,
		       t.reminder_enabled, t.reminder_offset_minutes, t.completed_at, t.created_at, t.updated_at
		FROM tasks t
		LEFT JOIN courses c ON t.course_id = c.id
		WHERE t.id = ? AND t.user_id = ?
	`, id, user.ID).Scan(
		&t.ID, &t.UserID, &courseID, &courseName, &courseColor,
		&t.Title, &desc, &t.DeadlineAt, &t.Priority, &t.Status,
		&reminderEnabledInt, &t.ReminderOffsetMinutes, &completedAt, &t.CreatedAt, &t.UpdatedAt,
	)

	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "NOT_FOUND", "message": "Tugas tidak ditemukan"},
		})
	}

	if courseID.Valid {
		t.CourseID = &courseID.String
		t.CourseName = courseName.String
		t.CourseColor = courseColor.String
	}
	t.Description = desc.String
	t.ReminderEnabled = reminderEnabledInt == 1
	if completedAt.Valid {
		t.CompletedAt = &completedAt.String
	}

	if t.Status == "pending" {
		dlTime, err := time.Parse(time.RFC3339, t.DeadlineAt)
		if err == nil && dlTime.Before(time.Now().UTC()) {
			t.IsOverdue = true
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    t,
	})
}

func (h *Handler) Create(c *fiber.Ctx) error {
	user := c.Locals("user").(*auth.User)

	var req CreateTaskRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "INVALID_BODY", "message": "Format data tidak valid"},
		})
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "VALIDATION_ERROR", "message": "Judul tugas wajib diisi"},
		})
	}

	deadlineStr := strings.TrimSpace(req.DeadlineAt)
	if deadlineStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "VALIDATION_ERROR", "message": "Tenggat waktu (deadline) wajib diisi"},
		})
	}

	// Validate deadline time format
	parsedDeadline, err := time.Parse(time.RFC3339, deadlineStr)
	if err != nil {
		// try simple date format YYYY-MM-DDTHH:mm
		parsedDeadline, err = time.Parse("2006-01-02T15:04", deadlineStr)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{"code": "VALIDATION_ERROR", "message": "Format tenggat waktu tidak valid (gunakan format ISO 8601)"},
			})
		}
	}
	normalizedDeadline := parsedDeadline.UTC().Format(time.RFC3339)

	// Validate course ownership if course_id provided
	var validCourseID *string
	var courseName, courseColor string
	if req.CourseID != nil && strings.TrimSpace(*req.CourseID) != "" {
		cID := strings.TrimSpace(*req.CourseID)
		var cName, cColor sql.NullString
		err := h.db.QueryRow("SELECT name, color FROM courses WHERE id = ? AND user_id = ?", cID, user.ID).Scan(&cName, &cColor)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{"code": "INVALID_COURSE", "message": "Mata kuliah tidak valid atau bukan milik Anda"},
			})
		}
		validCourseID = &cID
		courseName = cName.String
		courseColor = cColor.String
	}

	priority := strings.ToLower(strings.TrimSpace(req.Priority))
	if priority != "low" && priority != "high" {
		priority = "medium"
	}

	reminderEnabled := 1
	if req.ReminderEnabled != nil && !*req.ReminderEnabled {
		reminderEnabled = 0
	}

	reminderOffset := 2880 // 2 days default (H-2)
	if req.ReminderOffsetMinutes != nil && *req.ReminderOffsetMinutes > 0 {
		reminderOffset = *req.ReminderOffsetMinutes
	}

	taskID := uuid.New().String()
	now := time.Now().UTC().Format(time.RFC3339)

	_, err = h.db.Exec(`
		INSERT INTO tasks (id, user_id, course_id, title, description, deadline_at, priority, status, reminder_enabled, reminder_offset_minutes, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
	`, taskID, user.ID, validCourseID, title, strings.TrimSpace(req.Description), normalizedDeadline, priority, reminderEnabled, reminderOffset, now, now)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal membuat tugas"},
		})
	}

	isOverdue := parsedDeadline.UTC().Before(time.Now().UTC())

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data": Task{
			ID:                    taskID,
			UserID:                user.ID,
			CourseID:              validCourseID,
			CourseName:            courseName,
			CourseColor:           courseColor,
			Title:                 title,
			Description:           strings.TrimSpace(req.Description),
			DeadlineAt:            normalizedDeadline,
			Priority:              priority,
			Status:                "pending",
			IsOverdue:             isOverdue,
			ReminderEnabled:       reminderEnabled == 1,
			ReminderOffsetMinutes: reminderOffset,
			CreatedAt:             now,
			UpdatedAt:             now,
		},
	})
}

func (h *Handler) Update(c *fiber.Ctx) error {
	user := c.Locals("user").(*auth.User)
	id := c.Params("id")

	var req UpdateTaskRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "INVALID_BODY", "message": "Format data tidak valid"},
		})
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "VALIDATION_ERROR", "message": "Judul tugas wajib diisi"},
		})
	}

	deadlineStr := strings.TrimSpace(req.DeadlineAt)
	parsedDeadline, err := time.Parse(time.RFC3339, deadlineStr)
	if err != nil {
		parsedDeadline, err = time.Parse("2006-01-02T15:04", deadlineStr)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{"code": "VALIDATION_ERROR", "message": "Format tenggat waktu tidak valid"},
			})
		}
	}
	normalizedDeadline := parsedDeadline.UTC().Format(time.RFC3339)

	var validCourseID *string
	if req.CourseID != nil && strings.TrimSpace(*req.CourseID) != "" {
		cID := strings.TrimSpace(*req.CourseID)
		var dummy int
		err := h.db.QueryRow("SELECT 1 FROM courses WHERE id = ? AND user_id = ?", cID, user.ID).Scan(&dummy)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{"code": "INVALID_COURSE", "message": "Mata kuliah tidak valid"},
			})
		}
		validCourseID = &cID
	}

	priority := strings.ToLower(strings.TrimSpace(req.Priority))
	if priority != "low" && priority != "high" {
		priority = "medium"
	}

	reminderEnabled := 1
	if req.ReminderEnabled != nil && !*req.ReminderEnabled {
		reminderEnabled = 0
	}

	reminderOffset := 2880
	if req.ReminderOffsetMinutes != nil && *req.ReminderOffsetMinutes > 0 {
		reminderOffset = *req.ReminderOffsetMinutes
	}

	status := "pending"
	var completedAt *string
	nowStr := time.Now().UTC().Format(time.RFC3339)
	if req.Status != nil && *req.Status == "completed" {
		status = "completed"
		completedAt = &nowStr
	}

	res, err := h.db.Exec(`
		UPDATE tasks
		SET course_id = ?, title = ?, description = ?, deadline_at = ?, priority = ?, status = ?,
		    reminder_enabled = ?, reminder_offset_minutes = ?, completed_at = ?, updated_at = ?
		WHERE id = ? AND user_id = ?
	`, validCourseID, title, strings.TrimSpace(req.Description), normalizedDeadline, priority, status,
		reminderEnabled, reminderOffset, completedAt, nowStr, id, user.ID)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal memperbarui tugas"},
		})
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "NOT_FOUND", "message": "Tugas tidak ditemukan"},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Tugas berhasil diperbarui",
	})
}

func (h *Handler) ToggleComplete(c *fiber.Ctx) error {
	user := c.Locals("user").(*auth.User)
	id := c.Params("id")

	var currentStatus string
	err := h.db.QueryRow("SELECT status FROM tasks WHERE id = ? AND user_id = ?", id, user.ID).Scan(&currentStatus)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "NOT_FOUND", "message": "Tugas tidak ditemukan"},
		})
	}

	nowStr := time.Now().UTC().Format(time.RFC3339)
	newStatus := "completed"
	var completedAt *string = &nowStr

	if currentStatus == "completed" {
		newStatus = "pending"
		completedAt = nil
	}

	_, err = h.db.Exec("UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ? AND user_id = ?",
		newStatus, completedAt, nowStr, id, user.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal mengubah status tugas"},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"id":           id,
			"status":       newStatus,
			"completed_at": completedAt,
		},
	})
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	user := c.Locals("user").(*auth.User)
	id := c.Params("id")

	res, err := h.db.Exec("DELETE FROM tasks WHERE id = ? AND user_id = ?", id, user.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal menghapus tugas"},
		})
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "NOT_FOUND", "message": "Tugas tidak ditemukan"},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Tugas berhasil dihapus",
	})
}

func (h *Handler) DashboardSummary(c *fiber.Ctx) error {
	user := c.Locals("user").(*auth.User)
	now := time.Now().UTC()
	nowStr := now.Format(time.RFC3339)
	nearing48h := now.Add(48 * time.Hour).Format(time.RFC3339)

	var activeCount, completedCount, overdueCount, nearingCount int

	_ = h.db.QueryRow("SELECT COUNT(*) FROM tasks WHERE user_id = ? AND status = 'pending'", user.ID).Scan(&activeCount)
	_ = h.db.QueryRow("SELECT COUNT(*) FROM tasks WHERE user_id = ? AND status = 'completed'", user.ID).Scan(&completedCount)
	_ = h.db.QueryRow("SELECT COUNT(*) FROM tasks WHERE user_id = ? AND status = 'pending' AND deadline_at < ?", user.ID, nowStr).Scan(&overdueCount)
	_ = h.db.QueryRow("SELECT COUNT(*) FROM tasks WHERE user_id = ? AND status = 'pending' AND deadline_at >= ? AND deadline_at <= ?", user.ID, nowStr, nearing48h).Scan(&nearingCount)

	// Fetch upcoming tasks (limit 5)
	rows, err := h.db.Query(`
		SELECT t.id, t.user_id, t.course_id, c.name, c.color, t.title, t.description,
		       t.deadline_at, t.priority, t.status, t.reminder_enabled, t.reminder_offset_minutes,
		       t.completed_at, t.created_at, t.updated_at
		FROM tasks t
		LEFT JOIN courses c ON t.course_id = c.id
		WHERE t.user_id = ? AND t.status = 'pending'
		ORDER BY t.deadline_at ASC
		LIMIT 5
	`, user.ID)

	upcoming := make([]Task, 0)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var t Task
			var courseID, courseName, courseColor, desc, completedAt sql.NullString
			var reminderEnabledInt int
			if err := rows.Scan(
				&t.ID, &t.UserID, &courseID, &courseName, &courseColor,
				&t.Title, &desc, &t.DeadlineAt, &t.Priority, &t.Status,
				&reminderEnabledInt, &t.ReminderOffsetMinutes, &completedAt, &t.CreatedAt, &t.UpdatedAt,
			); err == nil {
				if courseID.Valid {
					t.CourseID = &courseID.String
					t.CourseName = courseName.String
					t.CourseColor = courseColor.String
				}
				t.Description = desc.String
				t.ReminderEnabled = reminderEnabledInt == 1
				dl, err := time.Parse(time.RFC3339, t.DeadlineAt)
				if err == nil && dl.Before(now) {
					t.IsOverdue = true
				}
				upcoming = append(upcoming, t)
			}
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"active_tasks":    activeCount,
			"completed_tasks": completedCount,
			"overdue_tasks":   overdueCount,
			"nearing_tasks":   nearingCount,
			"upcoming_tasks":  upcoming,
		},
	})
}
