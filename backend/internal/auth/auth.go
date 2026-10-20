package auth

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"task-reminder/backend/internal/database"
	"task-reminder/backend/internal/utils"
)

type User struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	WhatsAppNumber string `json:"whatsapp_number"`
	PasswordHash   string `json:"-"`
	Role           string `json:"role"`
	IsActive       bool   `json:"is_active"`
	CreatedAt      string `json:"created_at"`
	UpdatedAt      string `json:"updated_at"`
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

type Service struct {
	db *database.DB
}

func NewService(db *database.DB) *Service {
	return &Service{db: db}
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

	_, err = tx.Exec(`INSERT INTO users (id, name, whatsapp_number, password_hash, role, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, 'user', 1, ?, ?)`,
		userID, name, phone, string(hash), now, now)
	if err != nil {
		return nil, "", err
	}

	// Default user settings
	_, err = tx.Exec(`INSERT INTO user_settings (user_id, timezone, reminder_enabled, default_reminder_offset_minutes, updated_at)
		VALUES (?, 'Asia/Jakarta', 1, 2880, ?)`, userID, now)
	if err != nil {
		return nil, "", err
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
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	return user, sessionToken, nil
}

func (s *Service) Login(req LoginRequest) (*User, string, error) {
	phone, err := utils.NormalizePhoneNumber(req.WhatsAppNumber)
	if err != nil {
		return nil, "", errors.New("nomor WhatsApp tidak valid")
	}

	var user User
	var isActiveInt int
	err = s.db.QueryRow(`SELECT id, name, whatsapp_number, password_hash, role, is_active, created_at, updated_at
		FROM users WHERE whatsapp_number = ?`, phone).Scan(
		&user.ID, &user.Name, &user.WhatsAppNumber, &user.PasswordHash, &user.Role, &isActiveInt, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, "", errors.New("nomor WhatsApp atau password salah")
	}

	user.IsActive = isActiveInt == 1
	if !user.IsActive {
		return nil, "", errors.New("akun Anda telah dinonaktifkan. Silakan hubungi admin.")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, "", errors.New("nomor WhatsApp atau password salah")
	}

	sessionToken, err := s.CreateSession(user.ID)
	if err != nil {
		return nil, "", err
	}

	return &user, sessionToken, nil
}

func (s *Service) CreateSession(userID string) (string, error) {
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", err
	}
	token := hex.EncodeToString(tokenBytes)
	sessionID := uuid.New().String()
	now := time.Now().UTC()
	expiresAt := now.Add(30 * 24 * time.Hour).Format(time.RFC3339)
	nowStr := now.Format(time.RFC3339)

	_, err := s.db.Exec(`INSERT INTO sessions (id, user_id, session_token, expires_at, created_at, last_seen_at)
		VALUES (?, ?, ?, ?, ?, ?)`, sessionID, userID, token, expiresAt, nowStr, nowStr)
	if err != nil {
		return "", err
	}

	return token, nil
}

func (s *Service) createSessionTx(tx *sql.Tx, userID string) (string, error) {
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", err
	}
	token := hex.EncodeToString(tokenBytes)
	sessionID := uuid.New().String()
	now := time.Now().UTC()
	expiresAt := now.Add(30 * 24 * time.Hour).Format(time.RFC3339)
	nowStr := now.Format(time.RFC3339)

	_, err := tx.Exec(`INSERT INTO sessions (id, user_id, session_token, expires_at, created_at, last_seen_at)
		VALUES (?, ?, ?, ?, ?, ?)`, sessionID, userID, token, expiresAt, nowStr, nowStr)
	if err != nil {
		return "", err
	}

	return token, nil
}

func (s *Service) ValidateSession(token string) (*User, error) {
	if token == "" {
		return nil, errors.New("unauthorized")
	}

	now := time.Now().UTC().Format(time.RFC3339)
	var user User
	var isActiveInt int
	var sessionID string

	err := s.db.QueryRow(`
		SELECT s.id, u.id, u.name, u.whatsapp_number, u.password_hash, u.role, u.is_active, u.created_at, u.updated_at
		FROM sessions s
		JOIN users u ON s.user_id = u.id
		WHERE s.session_token = ? AND s.expires_at > ?
	`, token, now).Scan(
		&sessionID, &user.ID, &user.Name, &user.WhatsAppNumber, &user.PasswordHash, &user.Role, &isActiveInt, &user.CreatedAt, &user.UpdatedAt,
	)

	if err != nil {
		return nil, errors.New("sesi tidak valid atau telah berakhir")
	}

	user.IsActive = isActiveInt == 1
	if !user.IsActive {
		return nil, errors.New("akun tidak aktif")
	}

	// Update last_seen_at non-blocking
	go func() {
		s.db.Exec("UPDATE sessions SET last_seen_at = ? WHERE id = ?", now, sessionID)
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

// Cookie helper
func isRequestHTTPS(c *fiber.Ctx) bool {
	if v := os.Getenv("FORCE_SECURE_COOKIE"); v != "" {
		return strings.EqualFold(v, "true") || v == "1"
	}

	proto := strings.ToLower(c.Get("X-Forwarded-Proto"))
	if proto == "https" {
		return true
	}

	if strings.EqualFold(c.Get("X-Forwarded-Ssl"), "on") {
		return true
	}

	if strings.Contains(strings.ToLower(c.Get("Cf-Visitor")), `"scheme":"https"`) {
		return true
	}

	return c.Protocol() == "https"
}

func SetSessionCookie(c *fiber.Ctx, token string) {
	isSecure := isRequestHTTPS(c)
	c.Cookie(&fiber.Cookie{
		Name:     "session_id",
		Value:    token,
		Path:     "/",
		Expires:  time.Now().Add(30 * 24 * time.Hour),
		HTTPOnly: true,
		Secure:   isSecure,
		SameSite: "Lax",
	})
}

func ClearSessionCookie(c *fiber.Ctx) {
	isSecure := isRequestHTTPS(c)
	c.Cookie(&fiber.Cookie{
		Name:     "session_id",
		Value:    "",
		Path:     "/",
		Expires:  time.Now().Add(-24 * time.Hour),
		HTTPOnly: true,
		Secure:   isSecure,
		SameSite: "Lax",
	})
}

// Middleware
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
