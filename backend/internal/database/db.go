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

	dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)", dbPath)
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

func (db *DB) Migrate() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			whatsapp_number TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			role TEXT NOT NULL DEFAULT 'user',
			is_active INTEGER NOT NULL DEFAULT 1,
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
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_plans_slug ON plans(slug);`,
	}

	for _, query := range queries {
		if _, err := db.Exec(query); err != nil {
			return fmt.Errorf("failed executing migration: %w (query: %s)", err, query)
		}
	}

	return nil
}

func (db *DB) SeedDefaults() error {
	now := time.Now().UTC().Format(time.RFC3339)

	// Seed default plans
	defaultPlans := []struct {
		Name        string
		Slug        string
		Description string
		Price       int
		CourseLimit int
		TaskLimit   int
	}{
		{"Free", "free", "Paket gratis untuk mencoba Task Reminder", 0, 2, 4},
		{"Basic", "basic", "Paket hemat untuk mahasiswa santai", 5000, 4, 6},
		{"Sibuk", "sibuk", "Paket pas untuk mahasiswa dengan aktivitas padat", 10000, 6, 10},
		{"SuperSibuk", "supersibuk", "Paket maksimal tanpa batas untuk mahasiswa aktif & organisasi", 15000, 15, 30},
	}

	for _, p := range defaultPlans {
		var exists int
		err := db.QueryRow("SELECT COUNT(*) FROM plans WHERE slug = ?", p.Slug).Scan(&exists)
		if err == nil && exists == 0 {
			planID := uuid.New().String()
			_, err = db.Exec(`INSERT INTO plans (id, name, slug, description, price, billing_period, course_limit, task_limit, is_active, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, 'monthly', ?, ?, 1, ?, ?)`,
				planID, p.Name, p.Slug, p.Description, p.Price, p.CourseLimit, p.TaskLimit, now, now)
			if err != nil {
				return fmt.Errorf("failed seeding plan %s: %w", p.Slug, err)
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
	err := db.QueryRow("SELECT COUNT(*) FROM users WHERE role = 'admin'").Scan(&adminExists)
	if err == nil && adminExists == 0 {
		hash, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
		if err == nil {
			adminID := uuid.New().String()
			_, err = db.Exec(`INSERT INTO users (id, name, whatsapp_number, password_hash, role, is_active, created_at, updated_at)
				VALUES (?, 'Administrator', ?, ?, 'admin', 1, ?, ?)`,
				adminID, adminPhone, string(hash), now, now)
			if err == nil {
				// Seed settings for admin
				db.Exec(`INSERT INTO user_settings (user_id, timezone, reminder_enabled, default_reminder_offset_minutes, updated_at)
					VALUES (?, 'Asia/Jakarta', 1, 2880, ?)`, adminID, now)
			}
		}
	}

	return nil
}
