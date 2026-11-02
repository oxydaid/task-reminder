package subscriptions

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"task-reminder/backend/internal/auth"
	"task-reminder/backend/internal/database"
	"task-reminder/backend/internal/outbox"
	"task-reminder/backend/internal/plans"
)

type Subscription struct {
	ID               string      `json:"id"`
	UserID           string      `json:"user_id"`
	PlanID           string      `json:"plan_id"`
	Plan             *plans.Plan `json:"plan,omitempty"`
	Status           string      `json:"status"` // active, expired, cancelled, pending, trialing
	SubscriptionType string      `json:"subscription_type"` // paid, trial, free
	StartedAt        string      `json:"started_at"`
	ExpiresAt        *string     `json:"expires_at"`
	ActivatedAt      string      `json:"activated_at"`
	CancelledAt      *string     `json:"cancelled_at,omitempty"`
	CreatedAt        string      `json:"created_at"`
	UpdatedAt        string      `json:"updated_at"`
}

type SubscriptionLog struct {
	ID             string `json:"id"`
	SubscriptionID string `json:"subscription_id"`
	UserID         string `json:"user_id"`
	Action         string `json:"action"`
	PreviousPlanID string `json:"previous_plan_id,omitempty"`
	NewPlanID      string `json:"new_plan_id,omitempty"`
	AdminID        string `json:"admin_id,omitempty"`
	Reason         string `json:"reason,omitempty"`
	CreatedAt      string `json:"created_at"`
}

type UserUsage struct {
	ActivePlan        plans.Plan `json:"active_plan"`
	Subscription      *Subscription `json:"subscription,omitempty"`
	CourseCount       int        `json:"course_count"`
	CourseLimit       int        `json:"course_limit"`
	TaskCount         int        `json:"task_count"`
	TaskLimit         int        `json:"task_limit"`
	NotificationCount int        `json:"notification_count"`
	NotificationLimit int        `json:"notification_limit"`
	IsOverLimit       bool       `json:"is_over_limit"`
	DaysRemaining     int        `json:"days_remaining"`
}

type Service struct {
	db     *database.DB
	outbox *outbox.Service
	loc    *time.Location
}

func NewService(db *database.DB, outbox *outbox.Service) *Service {
	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		loc = time.FixedZone("WIB", 7*3600)
	}
	return &Service{db: db, outbox: outbox, loc: loc}
}

// GetActivePlan returns the active plan and subscription for a user.
// If no subscription or if expired, falls back gracefully to the Free plan.
func (s *Service) GetActivePlan(userID string) (plans.Plan, *Subscription, error) {
	var sub Subscription
	var p plans.Plan
	var pDesc sql.NullString
	var expiresAt, cancelledAt sql.NullString

	nowUTC := time.Now().UTC()

	// Find the most recent active or trialing subscription
	query := `
		SELECT s.id, s.user_id, s.plan_id, s.status, s.subscription_type, s.started_at, s.expires_at, s.activated_at, s.cancelled_at, s.created_at, s.updated_at,
		       p.id, p.name, p.slug, p.description, p.price, p.billing_period, p.course_limit, p.task_limit, p.notification_limit, p.is_active
		FROM subscriptions s
		JOIN plans p ON s.plan_id = p.id
		WHERE s.user_id = ? AND s.status IN ('active', 'trialing')
		ORDER BY s.created_at DESC
		LIMIT 1
	`
	err := s.db.QueryRow(query, userID).Scan(
		&sub.ID, &sub.UserID, &sub.PlanID, &sub.Status, &sub.SubscriptionType,
		&sub.StartedAt, &expiresAt, &sub.ActivatedAt, &cancelledAt, &sub.CreatedAt, &sub.UpdatedAt,
		&p.ID, &p.Name, &p.Slug, &pDesc, &p.Price, &p.BillingPeriod, &p.CourseLimit, &p.TaskLimit, &p.NotificationLimit, &p.IsActive,
	)

	if err == nil {
		p.Description = pDesc.String
		if expiresAt.Valid {
			sub.ExpiresAt = &expiresAt.String
		}
		if cancelledAt.Valid {
			sub.CancelledAt = &cancelledAt.String
		}
		sub.Plan = &p

		// Check if expired
		if sub.ExpiresAt != nil {
			expTime, parseErr := time.Parse(time.RFC3339, *sub.ExpiresAt)
			if parseErr == nil && nowUTC.After(expTime) {
				// Subscription has expired; entitlement automatically returns Free plan
				return s.getFreePlan(userID)
			}
		}

		return p, &sub, nil
	}

	// Fallback to Free plan
	return s.getFreePlan(userID)
}

func (s *Service) getFreePlan(userID string) (plans.Plan, *Subscription, error) {
	var p plans.Plan
	var pDesc sql.NullString
	err := s.db.QueryRow(`
		SELECT id, name, slug, description, price, billing_period, course_limit, task_limit, notification_limit, is_active
		FROM plans WHERE slug = 'free'
	`).Scan(&p.ID, &p.Name, &p.Slug, &pDesc, &p.Price, &p.BillingPeriod, &p.CourseLimit, &p.TaskLimit, &p.NotificationLimit, &p.IsActive)
	if err != nil {
		// Hardcoded fallback default if free plan row is missing
		return plans.Plan{
			ID:                "free",
			Name:              "Free",
			Slug:              "free",
			Description:       "Paket gratis default",
			CourseLimit:       2,
			TaskLimit:         4,
			NotificationLimit: 3,
			IsActive:          true,
		}, nil, nil
	}
	p.Description = pDesc.String

	// Build a virtual free subscription
	sub := &Subscription{
		ID:               "free-" + userID,
		UserID:           userID,
		PlanID:           p.ID,
		Plan:             &p,
		Status:           "active",
		SubscriptionType: "free",
		StartedAt:        time.Now().UTC().Format(time.RFC3339),
		ActivatedAt:      time.Now().UTC().Format(time.RFC3339),
	}
	return p, sub, nil
}

// Entitlement check: Can user create another course?
func (s *Service) CanCreateCourse(userID string) (bool, string, error) {
	plan, _, err := s.GetActivePlan(userID)
	if err != nil {
		return false, "Gagal memeriksa paket langganan", err
	}

	var count int
	err = s.db.QueryRow("SELECT COUNT(*) FROM courses WHERE user_id = ?", userID).Scan(&count)
	if err != nil {
		return false, "Gagal menghitung mata kuliah", err
	}

	if count >= plan.CourseLimit {
		msg := fmt.Sprintf("Batas mata kuliah untuk paket %s telah tercapai (maksimal %d mata kuliah). Silakan upgrade paket langganan Anda.", plan.Name, plan.CourseLimit)
		return false, msg, nil
	}

	return true, "", nil
}

// Entitlement check: Can user create another task?
func (s *Service) CanCreateTask(userID string) (bool, string, error) {
	plan, _, err := s.GetActivePlan(userID)
	if err != nil {
		return false, "Gagal memeriksa paket langganan", err
	}

	var count int
	err = s.db.QueryRow("SELECT COUNT(*) FROM tasks WHERE user_id = ?", userID).Scan(&count)
	if err != nil {
		return false, "Gagal menghitung tugas", err
	}

	if count >= plan.TaskLimit {
		msg := fmt.Sprintf("Batas tugas untuk paket %s telah tercapai (maksimal %d tugas). Silakan upgrade paket langganan Anda.", plan.Name, plan.TaskLimit)
		return false, msg, nil
	}

	return true, "", nil
}

// Entitlement check: Can user enable reminder on another task?
func (s *Service) CanEnableReminder(userID, taskIDToIgnore string) (bool, string, error) {
	plan, _, err := s.GetActivePlan(userID)
	if err != nil {
		return false, "Gagal memeriksa paket langganan", err
	}

	query := "SELECT COUNT(*) FROM tasks WHERE user_id = ? AND reminder_enabled = 1 AND status = 'pending'"
	args := []interface{}{userID}
	if taskIDToIgnore != "" {
		query += " AND id != ?"
		args = append(args, taskIDToIgnore)
	}

	var count int
	err = s.db.QueryRow(query, args...).Scan(&count)
	if err != nil {
		return false, "Gagal menghitung pengingat", err
	}

	if count >= plan.NotificationLimit {
		msg := fmt.Sprintf("Batas notifikasi aktif untuk paket %s telah tercapai (maksimal %d pengingat tugas). Silakan upgrade paket langganan Anda.", plan.Name, plan.NotificationLimit)
		return false, msg, nil
	}

	return true, "", nil
}

// GetUserUsage calculates current resource counts and limits
func (s *Service) GetUserUsage(userID string) (*UserUsage, error) {
	plan, sub, err := s.GetActivePlan(userID)
	if err != nil {
		return nil, err
	}

	var courseCount int
	_ = s.db.QueryRow("SELECT COUNT(*) FROM courses WHERE user_id = ?", userID).Scan(&courseCount)

	var taskCount int
	_ = s.db.QueryRow("SELECT COUNT(*) FROM tasks WHERE user_id = ?", userID).Scan(&taskCount)

	var notifCount int
	_ = s.db.QueryRow("SELECT COUNT(*) FROM tasks WHERE user_id = ? AND reminder_enabled = 1 AND status = 'pending'", userID).Scan(&notifCount)

	daysRemaining := 0
	if sub != nil && sub.ExpiresAt != nil {
		expTime, err := time.Parse(time.RFC3339, *sub.ExpiresAt)
		if err == nil {
			rem := time.Until(expTime)
			if rem > 0 {
				daysRemaining = int(rem.Hours()/24) + 1
			}
		}
	}

	usage := &UserUsage{
		ActivePlan:        plan,
		Subscription:      sub,
		CourseCount:       courseCount,
		CourseLimit:       plan.CourseLimit,
		TaskCount:         taskCount,
		TaskLimit:         plan.TaskLimit,
		NotificationCount: notifCount,
		NotificationLimit: plan.NotificationLimit,
		IsOverLimit:       notifCount > plan.NotificationLimit || courseCount > plan.CourseLimit || taskCount > plan.TaskLimit,
		DaysRemaining:     daysRemaining,
	}

	return usage, nil
}

// CheckExpirations checks and marks expired subscriptions, sends WhatsApp notification
func (s *Service) CheckExpirations() {
	nowStr := time.Now().UTC().Format(time.RFC3339)
	nowUTC := time.Now().UTC()

	// 1. Expire past subscriptions
	rows, err := s.db.Query(`
		SELECT s.id, s.user_id, s.plan_id, p.name, u.whatsapp_number, u.name, s.expires_at
		FROM subscriptions s
		JOIN plans p ON s.plan_id = p.id
		JOIN users u ON s.user_id = u.id
		WHERE s.status IN ('active', 'trialing')
		  AND s.expires_at IS NOT NULL
		  AND s.expires_at <= ?
	`, nowStr)
	if err == nil {
		type ExpiredSub struct {
			ID          string
			UserID      string
			PlanID      string
			PlanName    string
			Phone       string
			UserName    string
			ExpiresAt   string
		}

		expiredList := make([]ExpiredSub, 0)
		for rows.Next() {
			var es ExpiredSub
			if err := rows.Scan(&es.ID, &es.UserID, &es.PlanID, &es.PlanName, &es.Phone, &es.UserName, &es.ExpiresAt); err == nil {
				expiredList = append(expiredList, es)
			}
		}
		rows.Close()

		for _, es := range expiredList {
			// Update subscription status to expired
			_, _ = s.db.Exec(`UPDATE subscriptions SET status = 'expired', updated_at = ? WHERE id = ?`, nowStr, es.ID)

			// Log to subscription_logs
			logID := uuid.New().String()
			_, _ = s.db.Exec(`
				INSERT INTO subscription_logs (id, subscription_id, user_id, action, previous_plan_id, reason, created_at)
				VALUES (?, ?, ?, 'expired', ?, 'Masa aktif berakhir otomatis oleh scheduler', ?)
			`, logID, es.ID, es.UserID, es.PlanID, nowStr)

			// Send WhatsApp notice
			if s.outbox != nil {
				msg := fmt.Sprintf(`Halo %s! ℹ️ Masa aktif paket langganan *%s* kamu telah berakhir pada hari ini.

Akun kamu kini otomatis kembali ke paket *Free*. Tenang, seluruh tugas dan mata kuliah kamu tetap tersimpan aman dan tidak dihapus!

Jika ingin memperpanjang paket atau upgrade agar mendapatkan kuota maksimal kembali, silakan kunjungi website Task Reminder. Terima kasih! 🙏`, es.UserName, es.PlanName)
				dedup := fmt.Sprintf("sub_expired_%s", es.ID)
				_, _ = s.outbox.Enqueue(es.Phone, msg, "", dedup)
			}
			log.Printf("[Subscriptions] Marked subscription %s as expired for user %s", es.ID, es.UserID)
		}
	}

	// 2. Reminder H-1 for subscriptions expiring within 24 hours
	tomorrowUTC := nowUTC.Add(24 * time.Hour).Format(time.RFC3339)
	rowsRem, err := s.db.Query(`
		SELECT s.id, s.user_id, s.plan_id, p.name, u.whatsapp_number, u.name, s.expires_at
		FROM subscriptions s
		JOIN plans p ON s.plan_id = p.id
		JOIN users u ON s.user_id = u.id
		WHERE s.status IN ('active', 'trialing')
		  AND s.expires_at IS NOT NULL
		  AND s.expires_at > ?
		  AND s.expires_at <= ?
	`, nowStr, tomorrowUTC)
	if err == nil {
		for rowsRem.Next() {
			var id, uID, pID, pName, phone, uName, expAt string
			if err := rowsRem.Scan(&id, &uID, &pID, &pName, &phone, &uName, &expAt); err == nil {
				if s.outbox != nil {
					dedup := fmt.Sprintf("sub_expiring_h1_%s", id)
					msg := fmt.Sprintf(`Halo %s! ⏰ Paket langganan *%s* kamu akan berakhir dalam 24 jam ke depan.

Untuk menjaga kuota tugas & notifikasi pengingat WhatsApp tetap maksimal tanpa jeda, kamu bisa memperpanjang paket kapan saja melalui menu Langganan di web Task Reminder. 💪`, uName, pName)
					_, _ = s.outbox.Enqueue(phone, msg, "", dedup)
				}
			}
		}
		rowsRem.Close()
	}
}

// HTTP Handlers

type Handler struct {
	svc *Service
	db  *database.DB
}

func NewHandler(svc *Service, db *database.DB) *Handler {
	return &Handler{svc: svc, db: db}
}

// GetCurrent returns current user subscription and usage
func (h *Handler) GetCurrent(c *fiber.Ctx) error {
	user := c.Locals("user").(*auth.User)
	usage, err := h.svc.GetUserUsage(user.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "SERVER_ERROR", "message": "Gagal memuat status langganan"},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    usage,
	})
}

// GetHistory returns user subscription history
func (h *Handler) GetHistory(c *fiber.Ctx) error {
	user := c.Locals("user").(*auth.User)

	rows, err := h.db.Query(`
		SELECT s.id, s.user_id, s.plan_id, s.status, s.subscription_type, s.started_at, s.expires_at, s.activated_at, s.created_at,
		       p.name, p.slug, p.price, p.course_limit, p.task_limit, p.notification_limit
		FROM subscriptions s
		JOIN plans p ON s.plan_id = p.id
		WHERE s.user_id = ?
		ORDER BY s.created_at DESC
	`, user.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "SERVER_ERROR", "message": "Gagal mengambil riwayat langganan"},
		})
	}
	defer rows.Close()

	list := make([]fiber.Map, 0)
	for rows.Next() {
		var sID, uID, pID, status, subType, startedAt, actAt, createdAt string
		var pName, pSlug string
		var pPrice, cLimit, tLimit, nLimit int
		var expAt sql.NullString

		if err := rows.Scan(&sID, &uID, &pID, &status, &subType, &startedAt, &expAt, &actAt, &createdAt,
			&pName, &pSlug, &pPrice, &cLimit, &tLimit, &nLimit); err == nil {
			var expStr *string
			if expAt.Valid {
				expStr = &expAt.String
			}
			list = append(list, fiber.Map{
				"id":                sID,
				"user_id":           uID,
				"plan_id":           pID,
				"status":            status,
				"subscription_type": subType,
				"started_at":        startedAt,
				"expires_at":        expStr,
				"activated_at":      actAt,
				"created_at":        createdAt,
				"plan": fiber.Map{
					"name":               pName,
					"slug":               pSlug,
					"price":              pPrice,
					"course_limit":       cLimit,
					"task_limit":         tLimit,
					"notification_limit": nLimit,
				},
			})
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    list,
	})
}

// GetDowngradeStatus returns list of tasks so user can select active reminders when downgraded
func (h *Handler) GetDowngradeStatus(c *fiber.Ctx) error {
	user := c.Locals("user").(*auth.User)
	plan, _, err := h.svc.GetActivePlan(user.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "SERVER_ERROR", "message": "Gagal mengambil data"},
		})
	}

	rows, err := h.db.Query(`
		SELECT id, title, reminder_enabled, deadline_at
		FROM tasks
		WHERE user_id = ? AND status = 'pending'
		ORDER BY reminder_enabled DESC, deadline_at ASC
	`, user.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "SERVER_ERROR", "message": "Gagal memuat tugas"},
		})
	}
	defer rows.Close()

	type TaskItem struct {
		ID              string `json:"id"`
		Title           string `json:"title"`
		ReminderEnabled bool   `json:"reminder_enabled"`
		DeadlineAt      string `json:"deadline_at"`
	}

	items := make([]TaskItem, 0)
	activeCount := 0
	for rows.Next() {
		var item TaskItem
		var remInt int
		if err := rows.Scan(&item.ID, &item.Title, &remInt, &item.DeadlineAt); err == nil {
			item.ReminderEnabled = remInt == 1
			if item.ReminderEnabled {
				activeCount++
			}
			items = append(items, item)
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"plan_name":             plan.Name,
			"notification_limit":    plan.NotificationLimit,
			"active_reminder_count": activeCount,
			"is_over_limit":         activeCount > plan.NotificationLimit,
			"tasks":                 items,
		},
	})
}

// SelectActiveReminders allows user to pick which tasks keep reminder_enabled = 1
func (h *Handler) SelectActiveReminders(c *fiber.Ctx) error {
	user := c.Locals("user").(*auth.User)
	plan, _, err := h.svc.GetActivePlan(user.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "SERVER_ERROR", "message": "Gagal mengambil status langganan"},
		})
	}

	var req struct {
		TaskIDs []string `json:"task_ids"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "INVALID_BODY", "message": "Format data tidak valid"},
		})
	}

	if len(req.TaskIDs) > plan.NotificationLimit {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "LIMIT_EXCEEDED",
				"message": fmt.Sprintf("Maksimal hanya dapat memilih %d notifikasi pengingat untuk paket %s", plan.NotificationLimit, plan.Name),
			},
		})
	}

	nowStr := time.Now().UTC().Format(time.RFC3339)

	tx, err := h.db.Begin()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "SERVER_ERROR", "message": "Gagal memulai transaksi database"},
		})
	}
	defer tx.Rollback()

	// Disable all reminders first for this user
	_, err = tx.Exec("UPDATE tasks SET reminder_enabled = 0, updated_at = ? WHERE user_id = ?", nowStr, user.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "SERVER_ERROR", "message": "Gagal memperbarui status pengingat"},
		})
	}

	// Enable selected reminders
	if len(req.TaskIDs) > 0 {
		for _, tid := range req.TaskIDs {
			_, _ = tx.Exec("UPDATE tasks SET reminder_enabled = 1, updated_at = ? WHERE id = ? AND user_id = ?", nowStr, tid, user.ID)
		}
	}

	if err := tx.Commit(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "SERVER_ERROR", "message": "Gagal menyimpan perubahan"},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Pengaturan pengingat aktif berhasil diperbarui",
	})
}

// Admin Handlers

// ListAdmin returns all subscriptions with filter and search
func (h *Handler) ListAdmin(c *fiber.Ctx) error {
	statusFilter := c.Query("status")
	planFilter := c.Query("plan_id")

	query := `
		SELECT s.id, s.user_id, s.plan_id, s.status, s.subscription_type, s.started_at, s.expires_at, s.activated_at, s.created_at,
		       p.name, p.slug, p.price, u.name, u.whatsapp_number
		FROM subscriptions s
		JOIN plans p ON s.plan_id = p.id
		JOIN users u ON s.user_id = u.id
		WHERE 1=1
	`
	args := make([]interface{}, 0)

	if statusFilter != "" {
		query += " AND s.status = ?"
		args = append(args, statusFilter)
	}
	if planFilter != "" {
		query += " AND s.plan_id = ?"
		args = append(args, planFilter)
	}

	query += " ORDER BY s.created_at DESC LIMIT 100"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "SERVER_ERROR", "message": "Gagal mengambil daftar langganan"},
		})
	}
	defer rows.Close()

	list := make([]fiber.Map, 0)
	for rows.Next() {
		var sID, uID, pID, status, subType, startedAt, actAt, createdAt, pName, pSlug, uName, uPhone string
		var pPrice int
		var expAt sql.NullString
		if err := rows.Scan(&sID, &uID, &pID, &status, &subType, &startedAt, &expAt, &actAt, &createdAt, &pName, &pSlug, &pPrice, &uName, &uPhone); err == nil {
			var expStr *string
			if expAt.Valid {
				expStr = &expAt.String
			}
			list = append(list, fiber.Map{
				"id":                sID,
				"user_id":           uID,
				"user_name":         uName,
				"whatsapp_number":   uPhone,
				"plan_id":           pID,
				"plan_name":         pName,
				"plan_slug":         pSlug,
				"plan_price":        pPrice,
				"status":            status,
				"subscription_type": subType,
				"started_at":        startedAt,
				"expires_at":        expStr,
				"activated_at":      actAt,
				"created_at":        createdAt,
			})
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    list,
	})
}

// GrantTrial grants a trial to a user
func (h *Handler) GrantTrial(c *fiber.Ctx) error {
	admin := c.Locals("user").(*auth.User)
	targetUserID := c.Params("id")

	var req struct {
		PlanID       string `json:"plan_id"`
		DurationDays int    `json:"duration_days"`
		Reason       string `json:"reason"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "INVALID_BODY", "message": "Format data tidak valid"},
		})
	}

	if req.PlanID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "VALIDATION_ERROR", "message": "Plan wajib dipilih"},
		})
	}

	duration := req.DurationDays
	if duration <= 0 {
		duration = 7 // default 7 days trial
	}

	now := time.Now().UTC()
	nowStr := now.Format(time.RFC3339)
	expiresAt := now.Add(time.Duration(duration) * 24 * time.Hour).Format(time.RFC3339)

	var planName string
	err := h.db.QueryRow("SELECT name FROM plans WHERE id = ?", req.PlanID).Scan(&planName)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "NOT_FOUND", "message": "Paket tidak ditemukan"},
		})
	}

	subID := uuid.New().String()
	logID := uuid.New().String()

	tx, err := h.db.Begin()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal memproses transaksi"}})
	}
	defer tx.Rollback()

	// Deactivate any existing active subscriptions for user
	_, _ = tx.Exec("UPDATE subscriptions SET status = 'cancelled', cancelled_at = ? WHERE user_id = ? AND status = 'active'", nowStr, targetUserID)

	// Insert trial subscription
	_, err = tx.Exec(`
		INSERT INTO subscriptions (id, user_id, plan_id, status, subscription_type, started_at, expires_at, activated_at, created_at, updated_at)
		VALUES (?, ?, ?, 'trialing', 'trial', ?, ?, ?, ?, ?)
	`, subID, targetUserID, req.PlanID, nowStr, expiresAt, nowStr, nowStr, nowStr)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal menyimpan trial"}})
	}

	// Insert audit log
	reason := req.Reason
	if reason == "" {
		reason = fmt.Sprintf("Pemberian trial %d hari oleh admin", duration)
	}
	_, _ = tx.Exec(`
		INSERT INTO subscription_logs (id, subscription_id, user_id, action, new_plan_id, admin_id, reason, created_at)
		VALUES (?, ?, ?, 'trial_granted', ?, ?, ?, ?)
	`, logID, subID, targetUserID, req.PlanID, admin.ID, reason, nowStr)

	if err := tx.Commit(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal menyimpan data trial"}})
	}

	// Notify user via WhatsApp
	var phone, userName string
	_ = h.db.QueryRow("SELECT whatsapp_number, name FROM users WHERE id = ?", targetUserID).Scan(&phone, &userName)
	if phone != "" && h.svc.outbox != nil {
		msg := fmt.Sprintf(`Halo %s! 🎁 Selamat, akun kamu telah diberikan *Trial Gratis Paket %s* selama %d hari oleh Admin!

Masa aktif trial berlaku hingga: %s.
Nikmati kemudahan pengelolaan tugas kuliah & notifikasi WhatsApp otomatis di Task Reminder! 🚀`, userName, planName, duration, expiresAt[:10])
		_, _ = h.svc.outbox.Enqueue(phone, msg, "", fmt.Sprintf("trial_grant_%s", subID))
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": fmt.Sprintf("Berhasil memberikan trial %s (%d hari)", planName, duration),
	})
}

// ManualActivate allows admin to manually activate a plan for a user
func (h *Handler) ManualActivate(c *fiber.Ctx) error {
	admin := c.Locals("user").(*auth.User)
	targetUserID := c.Params("id")

	var req struct {
		PlanID         string `json:"plan_id"`
		DurationMonths int    `json:"duration_months"`
		Reason         string `json:"reason"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "INVALID_BODY", "message": "Format data tidak valid"}})
	}

	months := req.DurationMonths
	if months <= 0 {
		months = 1
	}

	now := time.Now().UTC()
	nowStr := now.Format(time.RFC3339)
	expiresAt := now.AddDate(0, months, 0).Format(time.RFC3339)

	var planName string
	err := h.db.QueryRow("SELECT name FROM plans WHERE id = ?", req.PlanID).Scan(&planName)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "NOT_FOUND", "message": "Paket tidak ditemukan"}})
	}

	subID := uuid.New().String()
	logID := uuid.New().String()

	tx, err := h.db.Begin()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal memproses transaksi"}})
	}
	defer tx.Rollback()

	_, _ = tx.Exec("UPDATE subscriptions SET status = 'cancelled', cancelled_at = ? WHERE user_id = ? AND status = 'active'", nowStr, targetUserID)

	_, err = tx.Exec(`
		INSERT INTO subscriptions (id, user_id, plan_id, status, subscription_type, started_at, expires_at, activated_at, created_at, updated_at)
		VALUES (?, ?, ?, 'active', 'paid', ?, ?, ?, ?, ?)
	`, subID, targetUserID, req.PlanID, nowStr, expiresAt, nowStr, nowStr, nowStr)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal menyimpan langganan"}})
	}

	reason := req.Reason
	if reason == "" {
		reason = fmt.Sprintf("Aktivasi manual %d bulan oleh admin", months)
	}
	_, _ = tx.Exec(`
		INSERT INTO subscription_logs (id, subscription_id, user_id, action, new_plan_id, admin_id, reason, created_at)
		VALUES (?, ?, ?, 'manual_activated', ?, ?, ?, ?)
	`, logID, subID, targetUserID, req.PlanID, admin.ID, reason, nowStr)

	if err := tx.Commit(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal menyimpan data"}})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": fmt.Sprintf("Paket %s berhasil diaktifkan untuk pengguna (%d bulan)", planName, months),
	})
}

// ManualCancel cancels user active subscription and resets them to Free
func (h *Handler) ManualCancel(c *fiber.Ctx) error {
	admin := c.Locals("user").(*auth.User)
	targetUserID := c.Params("id")

	var req struct {
		Reason string `json:"reason"`
	}
	_ = c.BodyParser(&req)

	nowStr := time.Now().UTC().Format(time.RFC3339)
	logID := uuid.New().String()

	tx, err := h.db.Begin()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal memproses pembatalan"}})
	}
	defer tx.Rollback()

	var activeSubID string
	_ = tx.QueryRow("SELECT id FROM subscriptions WHERE user_id = ? AND status = 'active'", targetUserID).Scan(&activeSubID)

	_, _ = tx.Exec("UPDATE subscriptions SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE user_id = ? AND status IN ('active', 'trialing')", nowStr, nowStr, targetUserID)

	reason := req.Reason
	if reason == "" {
		reason = "Dibatalkan manual oleh admin"
	}

	if activeSubID != "" {
		_, _ = tx.Exec(`
			INSERT INTO subscription_logs (id, subscription_id, user_id, action, admin_id, reason, created_at)
			VALUES (?, ?, ?, 'cancelled', ?, ?, ?)
		`, logID, activeSubID, targetUserID, admin.ID, reason, nowStr)
	}

	if err := tx.Commit(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal menyimpan pembatalan"}})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Langganan pengguna berhasil dibatalkan dan dikembalikan ke Free",
	})
}
