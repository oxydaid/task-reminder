package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"task-reminder/backend/internal/database"
	"task-reminder/backend/internal/outbox"
	"task-reminder/backend/internal/utils"
)

type User struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	WhatsAppNumber string  `json:"whatsapp_number"`
	PasswordHash   string  `json:"-"`
	Role           string  `json:"role"`
	IsActive       bool    `json:"is_active"`
	IsVerified     bool    `json:"is_verified"`
	VerifiedAt     *string `json:"verified_at,omitempty"`
	CreatedAt      string  `json:"created_at"`
	UpdatedAt      string  `json:"updated_at"`
}

type UserSettings struct {
	UserID                       string `json:"user_id"`
	Timezone                     string `json:"timezone"`
	ReminderEnabled              bool   `json:"reminder_enabled"`
	DefaultReminderOffsetMinutes int    `json:"default_reminder_offset_minutes"`
	UpdatedAt                    string `json:"updated_at"`
}

type RegisterRequest struct {
	Name           string `json:"name"`
	WhatsAppNumber string `json:"whatsapp_number"`
	Password       string `json:"password"`
}

type LoginRequest struct {
	WhatsAppNumber string `json:"whatsapp_number"`
	Password       string `json:"password"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

type ForgotPasswordRequest struct {
	WhatsAppNumber string `json:"whatsapp_number"`
}

type ResetPasswordRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"new_password"`
}

type VerifyRequest struct {
	Token string `json:"token"`
}

type Service struct {
	db     *database.DB
	outbox *outbox.Service
}

func NewService(db *database.DB, outboxSvc *outbox.Service) *Service {
	return &Service{db: db, outbox: outboxSvc}
}

func (s *Service) Register(req RegisterRequest) (*User, string, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, "", errors.New("nama lengkap tidak boleh kosong")
	}

	phone, err := utils.NormalizePhoneNumber(req.WhatsAppNumber)
	if err != nil {
		return nil, "", err
	}

	if len(req.Password) < 6 {
		return nil, "", errors.New("password minimal 6 karakter")
	}

	// Check if phone already registered
	var existingID string
	err = s.db.QueryRow("SELECT id FROM users WHERE whatsapp_number = ?", phone).Scan(&existingID)
	if err == nil && existingID != "" {
		return nil, "", errors.New("nomor WhatsApp sudah terdaftar")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, "", errors.New("gagal memproses password")
	}

	userID := uuid.New().String()
	now := time.Now().UTC().Format(time.RFC3339)

	tx, err := s.db.Begin()
	if err != nil {
		return nil, "", err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`INSERT INTO users (id, name, whatsapp_number, password_hash, role, is_active, is_verified, verified_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, 'user', 1, 1, ?, ?, ?)`,
		userID, name, phone, string(hash), now, now, now)
	if err != nil {
		return nil, "", err
	}

	// Default user settings
	_, err = tx.Exec(`INSERT INTO user_settings (user_id, timezone, reminder_enabled, default_reminder_offset_minutes, updated_at)
		VALUES (?, 'Asia/Jakarta', 1, 2880, ?)`, userID, now)
	if err != nil {
		return nil, "", err
	}

	// Default subscription: Free
	var freePlanID string
	_ = tx.QueryRow("SELECT id FROM plans WHERE slug = 'free'").Scan(&freePlanID)
	if freePlanID != "" {
		subID := uuid.New().String()
		_, _ = tx.Exec(`INSERT INTO subscriptions (id, user_id, plan_id, status, subscription_type, started_at, expires_at, activated_at, created_at, updated_at)
			VALUES (?, ?, ?, 'active', 'free', ?, NULL, ?, ?, ?)`,
			subID, userID, freePlanID, now, now, now, now)
	}

	sessionToken, err := s.createSessionTx(tx, userID)
	if err != nil {
		return nil, "", err
	}

	if err := tx.Commit(); err != nil {
		return nil, "", err
	}

	user := &User{
		ID:             userID,
		Name:           name,
		WhatsAppNumber: phone,
		Role:           "user",
		IsActive:       true,
		IsVerified:     true,
		VerifiedAt:     &now,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	// Welcome WhatsApp message
	if s.outbox != nil {
		msg := fmt.Sprintf(`Halo %s! 👋 Selamat datang di *Task Reminder*.

Akun kamu telah aktif dengan paket *Free*. Kamu bisa mulai mencatat mata kuliah dan tugas kuliahmu di website kami. Bot ini akan otomatis mengingatkan tugas-tugasmu sebelum tenggat waktu tiba.

Semangat belajarnya! 📚✨`, name)
		_, _ = s.outbox.Enqueue(phone, msg, "", fmt.Sprintf("welcome_%s", userID))
	}

	return user, sessionToken, nil
}

func (s *Service) Login(req LoginRequest) (*User, string, error) {
	phone, err := utils.NormalizePhoneNumber(req.WhatsAppNumber)
	if err != nil {
		return nil, "", errors.New("nomor WhatsApp tidak valid")
	}

	var user User
	var isActiveInt, isVerifiedInt int
	var verifiedAt sql.NullString
	err = s.db.QueryRow(`SELECT id, name, whatsapp_number, password_hash, role, is_active, is_verified, verified_at, created_at, updated_at
		FROM users WHERE whatsapp_number = ?`, phone).Scan(
		&user.ID, &user.Name, &user.WhatsAppNumber, &user.PasswordHash, &user.Role, &isActiveInt, &isVerifiedInt, &verifiedAt, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, "", errors.New("nomor WhatsApp atau password salah")
	}

	user.IsActive = isActiveInt == 1
	user.IsVerified = isVerifiedInt == 1
	if verifiedAt.Valid {
		user.VerifiedAt = &verifiedAt.String
	}

	if !user.IsActive {
		return nil, "", errors.New("akun Anda telah dinonaktifkan oleh administrator")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, "", errors.New("nomor WhatsApp atau password salah")
	}

	token, err := s.CreateSession(user.ID)
	if err != nil {
		return nil, "", errors.New("gagal membuat sesi login")
	}

	return &user, token, nil
}

func (s *Service) ForgotPassword(phoneInput, frontendURL string) error {
	phone, err := utils.NormalizePhoneNumber(phoneInput)
	if err != nil {
		return nil // Return generic success to prevent enumeration
	}

	var userID, userName string
	err = s.db.QueryRow("SELECT id, name FROM users WHERE whatsapp_number = ? AND is_active = 1", phone).Scan(&userID, &userName)
	if err != nil {
		return nil // User not found, silently succeed
	}

	// Generate secure token
	tokenBytes := make([]byte, 24)
	if _, err := rand.Read(tokenBytes); err != nil {
		return err
	}
	plainToken := hex.EncodeToString(tokenBytes)
	tokenHash := hashToken(plainToken)

	now := time.Now().UTC()
	nowStr := now.Format(time.RFC3339)
	expiresAt := now.Add(15 * time.Minute).Format(time.RFC3339)

	tokenID := uuid.New().String()
	_, err = s.db.Exec(`
		INSERT INTO verification_tokens (id, user_id, token_hash, token_type, expires_at, created_at)
		VALUES (?, ?, ?, 'password_reset', ?, ?)
	`, tokenID, userID, tokenHash, expiresAt, nowStr)
	if err != nil {
		return err
	}

	if s.outbox != nil {
		if frontendURL == "" {
			frontendURL = "http://localhost:3000"
		}
		frontendURL = strings.TrimRight(frontendURL, "/")
		resetLink := fmt.Sprintf("%s/reset-password?token=%s", frontendURL, plainToken)

		msg := fmt.Sprintf(`Halo %s! 🔐 Kami menerima permintaan reset password untuk akun Task Reminder Anda.

Silakan klik tautan berikut untuk membuat password baru:
%s

⏱️ Tautan ini berlaku selama 15 menit.
Jika Anda tidak pernah meminta reset password, abaikan pesan ini dengan aman.`, userName, resetLink)

		_, _ = s.outbox.Enqueue(phone, msg, "", fmt.Sprintf("pwd_reset_%s", tokenID))
	}

	return nil
}

func (s *Service) ResetPassword(token, newPassword string) error {
	if len(newPassword) < 6 {
		return errors.New("password baru minimal 6 karakter")
	}

	tokenHash := hashToken(token)
	nowStr := time.Now().UTC().Format(time.RFC3339)

	var tokenID, userID string
	var expiresAtStr string
	err := s.db.QueryRow(`
		SELECT id, user_id, expires_at FROM verification_tokens
		WHERE token_hash = ? AND token_type = 'password_reset' AND used_at IS NULL
	`, tokenHash).Scan(&tokenID, &userID, &expiresAtStr)
	if err != nil {
		return errors.New("token reset password tidak valid atau sudah digunakan")
	}

	expTime, err := time.Parse(time.RFC3339, expiresAtStr)
	if err != nil || time.Now().UTC().After(expTime) {
		return errors.New("token reset password telah kedaluwarsa")
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return errors.New("gagal memproses password baru")
	}

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Update password
	_, err = tx.Exec("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", string(newHash), nowStr, userID)
	if err != nil {
		return err
	}

	// Mark token as used
	_, err = tx.Exec("UPDATE verification_tokens SET used_at = ? WHERE id = ?", nowStr, tokenID)
	if err != nil {
		return err
	}

	// Invalidate previous sessions for security
	_, _ = tx.Exec("DELETE FROM sessions WHERE user_id = ?", userID)

	return tx.Commit()
}

func (s *Service) VerifyAccount(token string) error {
	tokenHash := hashToken(token)
	nowStr := time.Now().UTC().Format(time.RFC3339)

	var tokenID, userID string
	var expiresAtStr string
	err := s.db.QueryRow(`
		SELECT id, user_id, expires_at FROM verification_tokens
		WHERE token_hash = ? AND token_type = 'verification' AND used_at IS NULL
	`, tokenHash).Scan(&tokenID, &userID, &expiresAtStr)
	if err != nil {
		return errors.New("token verifikasi tidak valid atau sudah digunakan")
	}

	expTime, err := time.Parse(time.RFC3339, expiresAtStr)
	if err != nil || time.Now().UTC().After(expTime) {
		return errors.New("token verifikasi telah kedaluwarsa")
	}

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec("UPDATE users SET is_verified = 1, verified_at = ?, updated_at = ? WHERE id = ?", nowStr, nowStr, userID)
	if err != nil {
		return err
	}

	_, err = tx.Exec("UPDATE verification_tokens SET used_at = ? WHERE id = ?", nowStr, tokenID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func hashToken(token string) string {
	h := sha256.New()
	h.Write([]byte(token))
	return hex.EncodeToString(h.Sum(nil))
}

func (s *Service) CreateSession(userID string) (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	token := hex.EncodeToString(bytes)

	id := uuid.New().String()
	now := time.Now().UTC().Format(time.RFC3339)
	expiresAt := time.Now().UTC().Add(30 * 24 * time.Hour).Format(time.RFC3339)

	_, err := s.db.Exec(`INSERT INTO sessions (id, user_id, session_token, expires_at, created_at, last_seen_at)
		VALUES (?, ?, ?, ?, ?, ?)`, id, userID, token, expiresAt, now, now)
	if err != nil {
		return "", err
	}

	return token, nil
}

func (s *Service) createSessionTx(tx *sql.Tx, userID string) (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	token := hex.EncodeToString(bytes)

	id := uuid.New().String()
	now := time.Now().UTC().Format(time.RFC3339)
	expiresAt := time.Now().UTC().Add(30 * 24 * time.Hour).Format(time.RFC3339)

	_, err := tx.Exec(`INSERT INTO sessions (id, user_id, session_token, expires_at, created_at, last_seen_at)
		VALUES (?, ?, ?, ?, ?, ?)`, id, userID, token, expiresAt, now, now)
	if err != nil {
		return "", err
	}

	return token, nil
}

func (s *Service) ValidateSession(token string) (*User, error) {
	if token == "" {
		return nil, errors.New("sesi tidak ditemukan")
	}

	now := time.Now().UTC().Format(time.RFC3339)
	var user User
	var sessionID string
	var isActiveInt, isVerifiedInt int
	var verifiedAt sql.NullString

	query := `
		SELECT s.id, u.id, u.name, u.whatsapp_number, u.role, u.is_active, u.is_verified, u.verified_at, u.created_at, u.updated_at
		FROM sessions s
		JOIN users u ON s.user_id = u.id
		WHERE s.session_token = ? AND s.expires_at > ?
	`
	err := s.db.QueryRow(query, token, now).Scan(
		&sessionID, &user.ID, &user.Name, &user.WhatsAppNumber, &user.Role, &isActiveInt, &isVerifiedInt, &verifiedAt, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, errors.New("sesi telah kedaluwarsa atau tidak valid")
	}

	user.IsActive = isActiveInt == 1
	user.IsVerified = isVerifiedInt == 1
	if verifiedAt.Valid {
		user.VerifiedAt = &verifiedAt.String
	}

	if !user.IsActive {
		return nil, errors.New("akun tidak aktif")
	}

	go func() {
		_, _ = s.db.Exec("UPDATE sessions SET last_seen_at = ? WHERE id = ?", now, sessionID)
	}()

	return &user, nil
}

func (s *Service) DeleteSession(token string) error {
	if token == "" {
		return nil
	}
	_, err := s.db.Exec("DELETE FROM sessions WHERE session_token = ?", token)
	return err
}

func (s *Service) ChangePassword(userID, currentPassword, newPassword string) error {
	if len(newPassword) < 6 {
		return errors.New("password baru minimal 6 karakter")
	}

	var hash string
	err := s.db.QueryRow("SELECT password_hash FROM users WHERE id = ?", userID).Scan(&hash)
	if err != nil {
		return errors.New("pengguna tidak ditemukan")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(currentPassword)); err != nil {
		return errors.New("password lama salah")
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return errors.New("gagal memproses password baru")
	}

	now := time.Now().UTC().Format(time.RFC3339)
	_, err = s.db.Exec("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", string(newHash), now, userID)
	return err
}

// Cookie helpers
func isRequestHTTPS(c *fiber.Ctx) bool {
	if v := os.Getenv("FORCE_SECURE_COOKIE"); v != "" {
		return strings.EqualFold(v, "true") || v == "1"
	}
	proto := strings.ToLower(c.Get("X-Forwarded-Proto"))
	if proto == "https" || strings.EqualFold(c.Get("X-Forwarded-Ssl"), "on") || strings.Contains(strings.ToLower(c.Get("Cf-Visitor")), `"scheme":"https"`) {
		return true
	}
	return c.Protocol() == "https"
}

func SetSessionCookie(c *fiber.Ctx, token string) {
	c.Cookie(&fiber.Cookie{
		Name:     "session_id",
		Value:    token,
		Path:     "/",
		Expires:  time.Now().Add(30 * 24 * time.Hour),
		HTTPOnly: true,
		Secure:   isRequestHTTPS(c),
		SameSite: "Lax",
	})
}

func ClearSessionCookie(c *fiber.Ctx) {
	c.Cookie(&fiber.Cookie{
		Name:     "session_id",
		Value:    "",
		Path:     "/",
		Expires:  time.Now().Add(-24 * time.Hour),
		HTTPOnly: true,
		Secure:   isRequestHTTPS(c),
		SameSite: "Lax",
	})
}

func (s *Service) AuthRequired() fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := c.Cookies("session_id")
		if token == "" {
			authHeader := c.Get("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				token = strings.TrimPrefix(authHeader, "Bearer ")
			}
		}

		if token == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "UNAUTHORIZED",
					"message": "Silakan login terlebih dahulu",
				},
			})
		}

		user, err := s.ValidateSession(token)
		if err != nil {
			ClearSessionCookie(c)
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "UNAUTHORIZED",
					"message": err.Error(),
				},
			})
		}

		c.Locals("user", user)
		c.Locals("sessionToken", token)
		return c.Next()
	}
}

func AdminRequired() fiber.Handler {
	return func(c *fiber.Ctx) error {
		user, ok := c.Locals("user").(*User)
		if !ok || user == nil || user.Role != "admin" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "FORBIDDEN",
					"message": "Akses khusus administrator",
				},
			})
		}
		return c.Next()
	}
}
