package reminders

import (
	"database/sql"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"task-reminder/backend/internal/auth"
	"task-reminder/backend/internal/database"
	"task-reminder/backend/internal/whatsapp"
)

type ReminderLog struct {
	ID            string  `json:"id"`
	UserID        string  `json:"user_id"`
	TaskID        string  `json:"task_id"`
	TaskTitle     string  `json:"task_title"`
	CourseName    string  `json:"course_name,omitempty"`
	OffsetMinutes int     `json:"offset_minutes"`
	ScheduledAt   string  `json:"scheduled_at"`
	Status        string  `json:"status"` // 'pending', 'sent', 'failed'
	AttemptCount  int     `json:"attempt_count"`
	LastError     string  `json:"last_error,omitempty"`
	SentAt        *string `json:"sent_at,omitempty"`
	CreatedAt     string  `json:"created_at"`
}

type Scheduler struct {
	db     *database.DB
	wa     *whatsapp.Service
	loc    *time.Location
	ticker *time.Ticker
	stop   chan struct{}
	mu     sync.Mutex
}

func NewScheduler(db *database.DB, wa *whatsapp.Service) *Scheduler {
	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		loc = time.FixedZone("WIB", 7*3600)
	}

	return &Scheduler{
		db:   db,
		wa:   wa,
		loc:  loc,
		stop: make(chan struct{}),
	}
}

func (s *Scheduler) Start() {
	s.ticker = time.NewTicker(1 * time.Minute)
	log.Println("[Scheduler] Started checking deadline reminders every 1 minute")

	// Run initial check
	go s.CheckAndSend()

	go func() {
		for {
			select {
			case <-s.ticker.C:
				s.CheckAndSend()
			case <-s.stop:
				s.ticker.Stop()
				log.Println("[Scheduler] Stopped")
				return
			}
		}
	}()
}

func (s *Scheduler) Stop() {
	close(s.stop)
}

func (s *Scheduler) CheckAndSend() {
	s.mu.Lock()
	defer s.mu.Unlock()

	nowUTC := time.Now().UTC()

	// Query pending tasks that have reminders enabled and user settings reminder enabled
	query := `
		SELECT t.id, t.user_id, t.title, COALESCE(c.name, 'Umum') as course_name,
		       t.deadline_at, t.reminder_offset_minutes,
		       u.whatsapp_number, u.name as user_name
		FROM tasks t
		JOIN users u ON t.user_id = u.id
		LEFT JOIN courses c ON t.course_id = c.id
		LEFT JOIN user_settings us ON us.user_id = u.id
		WHERE t.status = 'pending'
		  AND t.reminder_enabled = 1
		  AND (us.reminder_enabled IS NULL OR us.reminder_enabled = 1)
		  AND u.is_active = 1
	`

	rows, err := s.db.Query(query)
	if err != nil {
		log.Printf("[Scheduler] Error querying eligible tasks: %v\n", err)
		return
	}
	defer rows.Close()

	type PendingTarget struct {
		TaskID        string
		UserID        string
		TaskTitle     string
		CourseName    string
		DeadlineAt    time.Time
		OffsetMinutes int
		UserPhone     string
		UserName      string
	}

	targets := make([]PendingTarget, 0)
	for rows.Next() {
		var pt PendingTarget
		var deadlineStr string
		if err := rows.Scan(&pt.TaskID, &pt.UserID, &pt.TaskTitle, &pt.CourseName, &deadlineStr, &pt.OffsetMinutes, &pt.UserPhone, &pt.UserName); err != nil {
			continue
		}

		dl, err := time.Parse(time.RFC3339, deadlineStr)
		if err != nil {
			continue
		}
		pt.DeadlineAt = dl

		if pt.OffsetMinutes <= 0 {
			pt.OffsetMinutes = 2880 // 2 days default
		}

		targets = append(targets, pt)
	}

	for _, pt := range targets {
		// Check intervals: primary configured offset (e.g. 2880 = 2 days), and optionally 1440 = 1 day if task is closer
		offsetsToCheck := []int{pt.OffsetMinutes}
		if pt.OffsetMinutes > 1440 {
			offsetsToCheck = append(offsetsToCheck, 1440)
		}

		for _, offset := range offsetsToCheck {
			reminderTime := pt.DeadlineAt.Add(-time.Duration(offset) * time.Minute)

			// If current time is past reminderTime, but not past the actual deadline
			if nowUTC.After(reminderTime) && nowUTC.Before(pt.DeadlineAt) {
				s.processSingleReminder(pt.TaskID, pt.UserID, pt.TaskTitle, pt.CourseName, pt.DeadlineAt, offset, pt.UserPhone, pt.UserName)
			}
		}
	}
}

func (s *Scheduler) processSingleReminder(taskID, userID, taskTitle, courseName string, deadlineAt time.Time, offset int, phone, userName string) {
	// Check if already sent or attempted too many times
	var status string
	var attemptCount int
	var logID string

	err := s.db.QueryRow(`
		SELECT id, status, attempt_count FROM reminder_logs
		WHERE task_id = ? AND offset_minutes = ?
	`, taskID, offset).Scan(&logID, &status, &attemptCount)

	nowStr := time.Now().UTC().Format(time.RFC3339)

	if err == nil {
		if status == "sent" {
			// Already sent, do nothing!
			return
		}
		if attemptCount >= 3 {
			// Exceeded retry count
			return
		}
	} else if err == sql.ErrNoRows {
		// Create initial pending record
		logID = uuid.New().String()
		scheduledAt := deadlineAt.Add(-time.Duration(offset) * time.Minute).Format(time.RFC3339)
		_, err = s.db.Exec(`
			INSERT INTO reminder_logs (id, user_id, task_id, reminder_type, offset_minutes, scheduled_at, status, attempt_count, created_at, updated_at)
			VALUES (?, ?, ?, 'deadline_reminder', ?, ?, 'pending', 0, ?, ?)
		`, logID, userID, taskID, offset, scheduledAt, nowStr, nowStr)
		if err != nil {
			return
		}
		attemptCount = 0
	} else {
		return
	}

	// Format deadline in Asia/Jakarta (WIB)
	dlWIB := deadlineAt.In(s.loc)
	monthsID := map[time.Month]string{
		time.January:   "Januari",
		time.February:  "Februari",
		time.March:     "Maret",
		time.April:     "April",
		time.May:       "Mei",
		time.June:      "Juni",
		time.July:      "Juli",
		time.August:    "Agustus",
		time.September: "September",
		time.October:   "Oktober",
		time.November:  "November",
		time.December:  "Desember",
	}

	dateFormatted := fmt.Sprintf("%d %s %d, %02d.%02d WIB",
		dlWIB.Day(), monthsID[dlWIB.Month()], dlWIB.Year(), dlWIB.Hour(), dlWIB.Minute())

	// Message template as specified in NEW_PRD.md
	message := fmt.Sprintf(`Halo! 👋 Pengingat tugas kamu:

*Judul:* %s
*Mata Kuliah:* %s
*Deadline:* %s

Jangan lupa diselesaikan, ya! 💪`, taskTitle, courseName, dateFormatted)

	attemptCount++
	sendErr := s.wa.SendMessage(phone, message)

	if sendErr != nil {
		log.Printf("[Scheduler] Failed sending reminder to %s for task '%s': %v\n", phone, taskTitle, sendErr)
		_, _ = s.db.Exec(`
			UPDATE reminder_logs
			SET status = 'failed', attempt_count = ?, last_error = ?, updated_at = ?
			WHERE id = ?
		`, attemptCount, sendErr.Error(), nowStr, logID)
	} else {
		log.Printf("[Scheduler] Successfully sent reminder to %s for task '%s'\n", phone, taskTitle)
		_, _ = s.db.Exec(`
			UPDATE reminder_logs
			SET status = 'sent', attempt_count = ?, sent_at = ?, last_error = '', updated_at = ?
			WHERE id = ?
		`, attemptCount, nowStr, nowStr, logID)
	}
}

// Handler for user's notification logs
type Handler struct {
	db *database.DB
}

func NewHandler(db *database.DB) *Handler {
	return &Handler{db: db}
}

func (h *Handler) List(c *fiber.Ctx) error {
	user := c.Locals("user").(*auth.User)

	rows, err := h.db.Query(`
		SELECT rl.id, rl.user_id, rl.task_id, t.title, COALESCE(c.name, ''),
		       rl.offset_minutes, rl.scheduled_at, rl.status, rl.attempt_count,
		       rl.last_error, rl.sent_at, rl.created_at
		FROM reminder_logs rl
		JOIN tasks t ON rl.task_id = t.id
		LEFT JOIN courses c ON t.course_id = c.id
		WHERE rl.user_id = ?
		ORDER BY rl.created_at DESC
		LIMIT 50
	`, user.ID)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal mengambil log notifikasi"},
		})
	}
	defer rows.Close()

	list := make([]ReminderLog, 0)
	for rows.Next() {
		var rl ReminderLog
		var courseName, lastError, sentAt sql.NullString
		if err := rows.Scan(
			&rl.ID, &rl.UserID, &rl.TaskID, &rl.TaskTitle, &courseName,
			&rl.OffsetMinutes, &rl.ScheduledAt, &rl.Status, &rl.AttemptCount,
			&lastError, &sentAt, &rl.CreatedAt,
		); err == nil {
			rl.CourseName = courseName.String
			rl.LastError = lastError.String
			if sentAt.Valid {
				rl.SentAt = &sentAt.String
			}
			list = append(list, rl)
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    list,
	})
}
