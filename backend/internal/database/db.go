package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

type DB struct {
	*sql.DB
}

func InitDB(dbPath string) (*DB, error) {
	dir := filepath.Dir(dbPath)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create db directory: %w", err)
		}
	}

	dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)&_pragma=busy_timeout(5000)&_pragma=cache_size(-64000)&_pragma=temp_store(MEMORY)&_pragma=mmap_size(268435456)", dbPath)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	db.SetMaxOpenConns(1) // SQLite single-writer safety
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(time.Hour)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping sqlite database: %w", err)
	}

	wrapped := &DB{db}
	if err := wrapped.Migrate(); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	if err := wrapped.SeedDefaults(); err != nil {
		return nil, fmt.Errorf("failed to seed default data: %w", err)
	}

	return wrapped, nil
}

func (db *DB) addColumnIfNotExists(table, column, colType string) {
	query := fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s;", table, column, colType)
	_, _ = db.Exec(query)
}

func (db *DB) Migrate() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			whatsapp_number TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			role TEXT NOT NULL DEFAULT 'user',
			is_active INTEGER NOT NULL DEFAULT 1,
			is_verified INTEGER NOT NULL DEFAULT 1,
			verified_at TEXT DEFAULT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_users_whatsapp ON users(whatsapp_number);`,
		`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);`,

		`CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			session_token TEXT NOT NULL UNIQUE,
			expires_at TEXT NOT NULL,
			created_at TEXT NOT NULL,
			last_seen_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);`,

		`CREATE TABLE IF NOT EXISTS courses (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			code TEXT DEFAULT '',
			lecturer TEXT DEFAULT '',
			color TEXT DEFAULT '#6366F1',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_courses_user_id ON courses(user_id);`,

		`CREATE TABLE IF NOT EXISTS tasks (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
			title TEXT NOT NULL,
			description TEXT DEFAULT '',
			deadline_at TEXT NOT NULL,
			priority TEXT NOT NULL DEFAULT 'medium',
			status TEXT NOT NULL DEFAULT 'pending',
			reminder_enabled INTEGER NOT NULL DEFAULT 1,
			reminder_offset_minutes INTEGER DEFAULT 2880,
			completed_at TEXT DEFAULT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);`,
		`CREATE INDEX IF NOT EXISTS idx_tasks_course_id ON tasks(course_id);`,
		`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);`,
		`CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline_at);`,
		`CREATE INDEX IF NOT EXISTS idx_tasks_scheduler ON tasks(status, reminder_enabled, deadline_at);`,

		`CREATE TABLE IF NOT EXISTS user_settings (
			user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
			reminder_enabled INTEGER NOT NULL DEFAULT 1,
			default_reminder_offset_minutes INTEGER NOT NULL DEFAULT 2880,
			updated_at TEXT NOT NULL
		);`,

		`CREATE TABLE IF NOT EXISTS reminder_logs (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
			reminder_type TEXT NOT NULL DEFAULT 'deadline_reminder',
			offset_minutes INTEGER NOT NULL DEFAULT 2880,
			scheduled_at TEXT NOT NULL,
			status TEXT NOT NULL,
			attempt_count INTEGER NOT NULL DEFAULT 0,
			last_error TEXT DEFAULT '',
			sent_at TEXT DEFAULT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			UNIQUE(task_id, offset_minutes)
		);`,
		`CREATE INDEX IF NOT EXISTS idx_reminder_logs_task ON reminder_logs(task_id);`,
		`CREATE INDEX IF NOT EXISTS idx_reminder_logs_user ON reminder_logs(user_id);`,
		`CREATE INDEX IF NOT EXISTS idx_reminder_logs_status ON reminder_logs(status);`,

		`CREATE TABLE IF NOT EXISTS plans (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			slug TEXT NOT NULL UNIQUE,
			description TEXT DEFAULT '',
			price INTEGER NOT NULL DEFAULT 0,
			billing_period TEXT NOT NULL DEFAULT 'monthly',
			course_limit INTEGER NOT NULL DEFAULT 2,
			task_limit INTEGER NOT NULL DEFAULT 4,
			notification_limit INTEGER NOT NULL DEFAULT 3,
			is_active INTEGER NOT NULL DEFAULT 1,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_plans_slug ON plans(slug);`,

		`CREATE TABLE IF NOT EXISTS subscriptions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			plan_id TEXT NOT NULL REFERENCES plans(id),
			status TEXT NOT NULL DEFAULT 'active',
			subscription_type TEXT NOT NULL DEFAULT 'free',
			started_at TEXT NOT NULL,
			expires_at TEXT DEFAULT NULL,
			activated_at TEXT NOT NULL,
			cancelled_at TEXT DEFAULT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_subs_user_id ON subscriptions(user_id);`,
		`CREATE INDEX IF NOT EXISTS idx_subs_status ON subscriptions(status);`,
		`CREATE INDEX IF NOT EXISTS idx_subs_expires_at ON subscriptions(expires_at);`,

		`CREATE TABLE IF NOT EXISTS subscription_logs (
			id TEXT PRIMARY KEY,
			subscription_id TEXT NOT NULL,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			action TEXT NOT NULL,
			previous_plan_id TEXT DEFAULT '',
			new_plan_id TEXT DEFAULT '',
			admin_id TEXT DEFAULT '',
			reason TEXT DEFAULT '',
			created_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_sub_logs_user_id ON subscription_logs(user_id);`,

		`CREATE TABLE IF NOT EXISTS payment_methods (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			type TEXT NOT NULL DEFAULT 'bank_transfer',
			bank_name TEXT DEFAULT '',
			account_name TEXT DEFAULT '',
			account_number TEXT DEFAULT '',
			qris_image_url TEXT DEFAULT '',
			description TEXT DEFAULT '',
			fee_type TEXT NOT NULL DEFAULT 'fixed',
			fee_percentage REAL NOT NULL DEFAULT 0,
			fee_fixed INTEGER NOT NULL DEFAULT 0,
			is_active INTEGER NOT NULL DEFAULT 1,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);`,

		`CREATE TABLE IF NOT EXISTS transactions (
			id TEXT PRIMARY KEY,
			code TEXT NOT NULL UNIQUE,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			plan_id TEXT NOT NULL REFERENCES plans(id),
			payment_method_id TEXT NOT NULL REFERENCES payment_methods(id),
			plan_name TEXT NOT NULL,
			plan_price INTEGER NOT NULL,
			plan_course_limit INTEGER NOT NULL,
			plan_task_limit INTEGER NOT NULL,
			plan_notification_limit INTEGER NOT NULL,
			payment_method_name TEXT NOT NULL,
			payment_method_type TEXT NOT NULL,
			payment_method_details TEXT DEFAULT '',
			fee_type TEXT NOT NULL DEFAULT 'fixed',
			fee_percentage REAL NOT NULL DEFAULT 0,
			fee_fixed INTEGER NOT NULL DEFAULT 0,
			fee_amount INTEGER NOT NULL DEFAULT 0,
			subtotal INTEGER NOT NULL,
			total_amount INTEGER NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending_payment',
			expires_at TEXT NOT NULL,
			paid_at TEXT DEFAULT NULL,
			verified_by TEXT DEFAULT '',
			admin_notes TEXT DEFAULT '',
			rejection_reason TEXT DEFAULT '',
			idempotency_key TEXT DEFAULT '',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_transactions_code ON transactions(code);`,
		`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);`,
		`CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);`,

		`CREATE TABLE IF NOT EXISTS payment_proofs (
			id TEXT PRIMARY KEY,
			transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			file_path TEXT NOT NULL,
			file_name TEXT NOT NULL,
			file_size INTEGER NOT NULL DEFAULT 0,
			mime_type TEXT NOT NULL,
			source TEXT NOT NULL DEFAULT 'web',
			notes TEXT DEFAULT '',
			created_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_payment_proofs_tx ON payment_proofs(transaction_id);`,

		`CREATE TABLE IF NOT EXISTS transaction_logs (
			id TEXT PRIMARY KEY,
			transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
			action TEXT NOT NULL,
			previous_status TEXT DEFAULT '',
			new_status TEXT NOT NULL,
			actor_id TEXT DEFAULT '',
			actor_role TEXT DEFAULT 'user',
			notes TEXT DEFAULT '',
			created_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_tx_logs_tx ON transaction_logs(transaction_id);`,

		`CREATE TABLE IF NOT EXISTS admin_notification_settings (
			admin_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			receive_transaction_notification INTEGER NOT NULL DEFAULT 1,
			receive_payment_proof_notification INTEGER NOT NULL DEFAULT 1,
			updated_at TEXT NOT NULL
		);`,

		`CREATE TABLE IF NOT EXISTS notification_logs (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			title TEXT NOT NULL,
			message TEXT NOT NULL,
			type TEXT NOT NULL,
			channel TEXT NOT NULL DEFAULT 'whatsapp',
			status TEXT NOT NULL DEFAULT 'sent',
			dedup_key TEXT NOT NULL UNIQUE,
			created_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_notif_logs_dedup ON notification_logs(dedup_key);`,

		`CREATE TABLE IF NOT EXISTS message_outbox (
			id TEXT PRIMARY KEY,
			recipient_phone TEXT NOT NULL,
			message_text TEXT NOT NULL,
			media_path TEXT DEFAULT '',
			status TEXT NOT NULL DEFAULT 'pending',
			attempt_count INTEGER NOT NULL DEFAULT 0,
			last_error TEXT DEFAULT '',
			dedup_key TEXT DEFAULT '',
			created_at TEXT NOT NULL,
			sent_at TEXT DEFAULT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_outbox_status ON message_outbox(status);`,

		`CREATE TABLE IF NOT EXISTS verification_tokens (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			token_hash TEXT NOT NULL UNIQUE,
			token_type TEXT NOT NULL,
			expires_at TEXT NOT NULL,
			used_at TEXT DEFAULT NULL,
			created_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_vtokens_hash ON verification_tokens(token_hash);`,
	}

	for _, query := range queries {
		if _, err := db.Exec(query); err != nil {
			return fmt.Errorf("failed executing migration: %w (query: %s)", err, query)
		}
	}

	// Dynamic column migrations for existing databases
	db.addColumnIfNotExists("users", "is_verified", "INTEGER NOT NULL DEFAULT 1")
	db.addColumnIfNotExists("users", "verified_at", "TEXT DEFAULT NULL")
	db.addColumnIfNotExists("plans", "notification_limit", "INTEGER NOT NULL DEFAULT 3")
	db.addColumnIfNotExists("plans", "sort_order", "INTEGER NOT NULL DEFAULT 0")

	return nil
}

func (db *DB) SeedDefaults() error {
	now := time.Now().UTC().Format(time.RFC3339)

	// Seed default plans with notification_limit and sort_order
	defaultPlans := []struct {
		Name              string
		Slug              string
		Description       string
		Price             int
		CourseLimit       int
		TaskLimit         int
		NotificationLimit int
		SortOrder         int
	}{
		{"Free", "free", "Paket gratis untuk mencoba Task Reminder", 0, 2, 4, 3, 1},
		{"Basic", "basic", "Paket hemat untuk mahasiswa santai", 5000, 4, 6, 5, 2},
		{"Sibuk", "sibuk", "Paket pas untuk mahasiswa dengan aktivitas padat", 10000, 6, 10, 7, 3},
		{"SuperSibuk", "supersibuk", "Paket maksimal tanpa batas untuk mahasiswa aktif & organisasi", 15000, 15, 30, 10, 4},
	}

	for _, p := range defaultPlans {
		var exists int
		err := db.QueryRow("SELECT COUNT(*) FROM plans WHERE slug = ?", p.Slug).Scan(&exists)
		if err == nil && exists == 0 {
			planID := uuid.New().String()
			_, err = db.Exec(`INSERT INTO plans (id, name, slug, description, price, billing_period, course_limit, task_limit, notification_limit, is_active, sort_order, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, 'monthly', ?, ?, ?, 1, ?, ?, ?)`,
				planID, p.Name, p.Slug, p.Description, p.Price, p.CourseLimit, p.TaskLimit, p.NotificationLimit, p.SortOrder, now, now)
			if err != nil {
				return fmt.Errorf("failed seeding plan %s: %w", p.Slug, err)
			}
		} else {
			// Update notification_limit and sort_order if they were default 0
			_, _ = db.Exec(`UPDATE plans SET notification_limit = ?, sort_order = ? WHERE slug = ? AND (notification_limit = 0 OR sort_order = 0)`,
				p.NotificationLimit, p.SortOrder, p.Slug)
		}
	}

	// Seed default payment methods if none exist
	var pmCount int
	err := db.QueryRow("SELECT COUNT(*) FROM payment_methods").Scan(&pmCount)
	if err == nil && pmCount == 0 {
		defaultMethods := []struct {
			Name          string
			Type          string
			BankName      string
			AccountName   string
			AccountNumber string
			QRISImageURL  string
			Description   string
			FeeType       string
			FeePercentage float64
			FeeFixed      int
			SortOrder     int
		}{
			{
				Name:          "Transfer Bank BCA",
				Type:          "bank_transfer",
				BankName:      "BCA",
				AccountName:   "Task Reminder Official",
				AccountNumber: "8001234567",
				Description:   "Transfer antar bank atau sesama BCA. Harap simpan bukti transfer.",
				FeeType:       "fixed",
				FeePercentage: 0,
				FeeFixed:      0,
				SortOrder:     1,
			},
			{
				Name:          "Transfer Bank Mandiri",
				Type:          "bank_transfer",
				BankName:      "Mandiri",
				AccountName:   "Task Reminder Official",
				AccountNumber: "1370019876543",
				Description:   "Transfer via Livin by Mandiri atau ATM. Harap simpan bukti transfer.",
				FeeType:       "fixed",
				FeePercentage: 0,
				FeeFixed:      0,
				SortOrder:     2,
			},
			{
				Name:          "QRIS All Payment (Gopay / OVO / Dana / BCA)",
				Type:          "qris",
				AccountName:   "Task Reminder",
				QRISImageURL:  "",
				Description:   "Pindai barcode QRIS menggunakan aplikasi e-wallet atau mobile banking favorit Anda.",
				FeeType:       "fixed",
				FeePercentage: 0,
				FeeFixed:      0,
				SortOrder:     3,
			},
		}

		for _, pm := range defaultMethods {
			pmID := uuid.New().String()
			_, err = db.Exec(`INSERT INTO payment_methods (id, name, type, bank_name, account_name, account_number, qris_image_url, description, fee_type, fee_percentage, fee_fixed, is_active, sort_order, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
				pmID, pm.Name, pm.Type, pm.BankName, pm.AccountName, pm.AccountNumber, pm.QRISImageURL, pm.Description, pm.FeeType, pm.FeePercentage, pm.FeeFixed, pm.SortOrder, now, now)
			if err != nil {
				return fmt.Errorf("failed seeding payment method %s: %w", pm.Name, err)
			}
		}
	}

	// Seed admin user if not exists
	adminPhone := os.Getenv("ADMIN_PHONE")
	if adminPhone == "" {
		adminPhone = "6281234567890"
	}
	adminPassword := os.Getenv("ADMIN_PASSWORD")
	if adminPassword == "" {
		adminPassword = "adminpassword123"
	}

	var adminExists int
	err = db.QueryRow("SELECT COUNT(*) FROM users WHERE role = 'admin'").Scan(&adminExists)
	if err == nil && adminExists == 0 {
		hash, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
		if err == nil {
			adminID := uuid.New().String()
			_, err = db.Exec(`INSERT INTO users (id, name, whatsapp_number, password_hash, role, is_active, is_verified, verified_at, created_at, updated_at)
				VALUES (?, 'Administrator', ?, ?, 'admin', 1, 1, ?, ?, ?)`,
				adminID, adminPhone, string(hash), now, now, now)
			if err == nil {
				// Seed settings for admin
				_, _ = db.Exec(`INSERT INTO user_settings (user_id, timezone, reminder_enabled, default_reminder_offset_minutes, updated_at)
					VALUES (?, 'Asia/Jakarta', 1, 2880, ?)`, adminID, now)
				// Seed admin notification settings
				_, _ = db.Exec(`INSERT INTO admin_notification_settings (admin_id, receive_transaction_notification, receive_payment_proof_notification, updated_at)
					VALUES (?, 1, 1, ?)`, adminID, now)
			}
		}
	} else {
		// Ensure all existing admins have notification settings
		var adminIDs []string
		rows, err := db.Query("SELECT id FROM users WHERE role = 'admin'")
		if err == nil {
			for rows.Next() {
				var aID string
				if err := rows.Scan(&aID); err == nil {
					adminIDs = append(adminIDs, aID)
				}
			}
			rows.Close()
			for _, aID := range adminIDs {
				_, _ = db.Exec(`INSERT OR IGNORE INTO admin_notification_settings (admin_id, receive_transaction_notification, receive_payment_proof_notification, updated_at)
					VALUES (?, 1, 1, ?)`, aID, now)
			}
		}
	}

	// Ensure all existing users have an active subscription (fallback to Free plan)
	var freePlanID string
	_ = db.QueryRow("SELECT id FROM plans WHERE slug = 'free'").Scan(&freePlanID)
	if freePlanID != "" {
		rows, err := db.Query(`SELECT u.id FROM users u LEFT JOIN subscriptions s ON u.id = s.user_id WHERE s.id IS NULL`)
		if err == nil {
			usersNeedingSub := make([]string, 0)
			for rows.Next() {
				var uID string
				if err := rows.Scan(&uID); err == nil {
					usersNeedingSub = append(usersNeedingSub, uID)
				}
			}
			rows.Close()

			for _, uID := range usersNeedingSub {
				subID := uuid.New().String()
				_, _ = db.Exec(`INSERT INTO subscriptions (id, user_id, plan_id, status, subscription_type, started_at, expires_at, activated_at, created_at, updated_at)
					VALUES (?, ?, ?, 'active', 'free', ?, NULL, ?, ?, ?)`,
					subID, uID, freePlanID, now, now, now, now)
			}
		}
	}

	return nil
}
