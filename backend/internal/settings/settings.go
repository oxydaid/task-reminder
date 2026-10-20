package settings

import (
	"database/sql"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"task-reminder/backend/internal/auth"
	"task-reminder/backend/internal/database"
)

type UserSettings struct {
	UserID                       string `json:"user_id"`
	Timezone                     string `json:"timezone"`
	ReminderEnabled              bool   `json:"reminder_enabled"`
	DefaultReminderOffsetMinutes int    `json:"default_reminder_offset_minutes"`
	UpdatedAt                    string `json:"updated_at"`
}

type UpdateSettingsRequest struct {
	Timezone                     *string `json:"timezone"`
	ReminderEnabled              *bool   `json:"reminder_enabled"`
	DefaultReminderOffsetMinutes *int    `json:"default_reminder_offset_minutes"`
}

type Handler struct {
	db *database.DB
}

func NewHandler(db *database.DB) *Handler {
	return &Handler{db: db}
}

func (h *Handler) Get(c *fiber.Ctx) error {
	user := c.Locals("user").(*auth.User)

	var s UserSettings
	var reminderInt int
	err := h.db.QueryRow(`
		SELECT user_id, timezone, reminder_enabled, default_reminder_offset_minutes, updated_at
		FROM user_settings WHERE user_id = ?
	`, user.ID).Scan(&s.UserID, &s.Timezone, &reminderInt, &s.DefaultReminderOffsetMinutes, &s.UpdatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			// Create default
			now := time.Now().UTC().Format(time.RFC3339)
			_, _ = h.db.Exec(`INSERT INTO user_settings (user_id, timezone, reminder_enabled, default_reminder_offset_minutes, updated_at)
				VALUES (?, 'Asia/Jakarta', 1, 2880, ?)`, user.ID, now)
			s = UserSettings{
				UserID:                       user.ID,
				Timezone:                     "Asia/Jakarta",
				ReminderEnabled:              true,
				DefaultReminderOffsetMinutes: 2880,
				UpdatedAt:                    now,
			}
		} else {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal mengambil pengaturan"},
			})
		}
	} else {
		s.ReminderEnabled = reminderInt == 1
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    s,
	})
}

func (h *Handler) Update(c *fiber.Ctx) error {
	user := c.Locals("user").(*auth.User)

	var req UpdateSettingsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "INVALID_BODY", "message": "Format data tidak valid"},
		})
	}

	var current UserSettings
	var currentReminderInt int
	err := h.db.QueryRow(`
		SELECT timezone, reminder_enabled, default_reminder_offset_minutes
		FROM user_settings WHERE user_id = ?
	`, user.ID).Scan(&current.Timezone, &currentReminderInt, &current.DefaultReminderOffsetMinutes)

	timezone := "Asia/Jakarta"
	reminderEnabled := 1
	offsetMinutes := 2880

	if err == nil {
		timezone = current.Timezone
		reminderEnabled = currentReminderInt
		offsetMinutes = current.DefaultReminderOffsetMinutes
	}

	if req.Timezone != nil && strings.TrimSpace(*req.Timezone) != "" {
		timezone = strings.TrimSpace(*req.Timezone)
	}
	if req.ReminderEnabled != nil {
		if *req.ReminderEnabled {
			reminderEnabled = 1
		} else {
			reminderEnabled = 0
		}
	}
	if req.DefaultReminderOffsetMinutes != nil && *req.DefaultReminderOffsetMinutes > 0 {
		offsetMinutes = *req.DefaultReminderOffsetMinutes
	}

	now := time.Now().UTC().Format(time.RFC3339)

	_, err = h.db.Exec(`
		INSERT INTO user_settings (user_id, timezone, reminder_enabled, default_reminder_offset_minutes, updated_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
			timezone = excluded.timezone,
			reminder_enabled = excluded.reminder_enabled,
			default_reminder_offset_minutes = excluded.default_reminder_offset_minutes,
			updated_at = excluded.updated_at
	`, user.ID, timezone, reminderEnabled, offsetMinutes, now)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal menyimpan pengaturan"},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": UserSettings{
			UserID:                       user.ID,
			Timezone:                     timezone,
			ReminderEnabled:              reminderEnabled == 1,
			DefaultReminderOffsetMinutes: offsetMinutes,
			UpdatedAt:                    now,
		},
	})
}
