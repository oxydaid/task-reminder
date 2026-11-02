package payment_methods

import (
	"database/sql"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"task-reminder/backend/internal/database"
)

type PaymentMethod struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	Type          string  `json:"type"` // bank_transfer, qris
	BankName      string  `json:"bank_name,omitempty"`
	AccountName   string  `json:"account_name,omitempty"`
	AccountNumber string  `json:"account_number,omitempty"`
	QRISImageURL  string  `json:"qris_image_url,omitempty"`
	Description   string  `json:"description,omitempty"`
	FeeType       string  `json:"fee_type"` // fixed, percentage, mixed
	FeePercentage float64 `json:"fee_percentage"`
	FeeFixed      int     `json:"fee_fixed"`
	IsActive      bool    `json:"is_active"`
	SortOrder     int     `json:"sort_order"`
	CreatedAt     string  `json:"created_at"`
	UpdatedAt     string  `json:"updated_at"`
}

type CreateMethodRequest struct {
	Name          string  `json:"name"`
	Type          string  `json:"type"`
	BankName      string  `json:"bank_name"`
	AccountName   string  `json:"account_name"`
	AccountNumber string  `json:"account_number"`
	QRISImageURL  string  `json:"qris_image_url"`
	Description   string  `json:"description"`
	FeeType       string  `json:"fee_type"`
	FeePercentage float64 `json:"fee_percentage"`
	FeeFixed      int     `json:"fee_fixed"`
	IsActive      *bool   `json:"is_active"`
	SortOrder     int     `json:"sort_order"`
}

type Handler struct {
	db *database.DB
}

func NewHandler(db *database.DB) *Handler {
	return &Handler{db: db}
}

// ListPublic returns active payment methods for checkout
func (h *Handler) ListPublic(c *fiber.Ctx) error {
	rows, err := h.db.Query(`
		SELECT id, name, type, bank_name, account_name, account_number, qris_image_url, description,
		       fee_type, fee_percentage, fee_fixed, is_active, sort_order, created_at, updated_at
		FROM payment_methods
		WHERE is_active = 1
		ORDER BY sort_order ASC, name ASC
	`)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "SERVER_ERROR", "message": "Gagal mengambil metode pembayaran"},
		})
	}
	defer rows.Close()

	list := make([]PaymentMethod, 0)
	for rows.Next() {
		var pm PaymentMethod
		var bName, aName, aNum, qrisUrl, desc sql.NullString
		var actInt int
		err := rows.Scan(
			&pm.ID, &pm.Name, &pm.Type, &bName, &aName, &aNum, &qrisUrl, &desc,
			&pm.FeeType, &pm.FeePercentage, &pm.FeeFixed, &actInt, &pm.SortOrder, &pm.CreatedAt, &pm.UpdatedAt,
		)
		if err == nil {
			pm.BankName = bName.String
			pm.AccountName = aName.String
			pm.AccountNumber = aNum.String
			pm.QRISImageURL = qrisUrl.String
			pm.Description = desc.String
			pm.IsActive = actInt == 1
			list = append(list, pm)
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    list,
	})
}

// ListAdmin returns all payment methods for admin
func (h *Handler) ListAdmin(c *fiber.Ctx) error {
	rows, err := h.db.Query(`
		SELECT id, name, type, bank_name, account_name, account_number, qris_image_url, description,
		       fee_type, fee_percentage, fee_fixed, is_active, sort_order, created_at, updated_at
		FROM payment_methods
		ORDER BY sort_order ASC, name ASC
	`)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "SERVER_ERROR", "message": "Gagal mengambil data metode pembayaran"},
		})
	}
	defer rows.Close()

	list := make([]PaymentMethod, 0)
	for rows.Next() {
		var pm PaymentMethod
		var bName, aName, aNum, qrisUrl, desc sql.NullString
		var actInt int
		err := rows.Scan(
			&pm.ID, &pm.Name, &pm.Type, &bName, &aName, &aNum, &qrisUrl, &desc,
			&pm.FeeType, &pm.FeePercentage, &pm.FeeFixed, &actInt, &pm.SortOrder, &pm.CreatedAt, &pm.UpdatedAt,
		)
		if err == nil {
			pm.BankName = bName.String
			pm.AccountName = aName.String
			pm.AccountNumber = aNum.String
			pm.QRISImageURL = qrisUrl.String
			pm.Description = desc.String
			pm.IsActive = actInt == 1
			list = append(list, pm)
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    list,
	})
}

// Create adds a new payment method
func (h *Handler) Create(c *fiber.Ctx) error {
	var req CreateMethodRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "INVALID_BODY", "message": "Format data tidak valid"},
		})
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "VALIDATION_ERROR", "message": "Nama metode pembayaran wajib diisi"},
		})
	}

	mType := strings.TrimSpace(req.Type)
	if mType != "bank_transfer" && mType != "qris" {
		mType = "bank_transfer"
	}

	feeType := strings.TrimSpace(req.FeeType)
	if feeType != "fixed" && feeType != "percentage" && feeType != "mixed" {
		feeType = "fixed"
	}

	isActive := 1
	if req.IsActive != nil && !*req.IsActive {
		isActive = 0
	}

	id := uuid.New().String()
	now := time.Now().UTC().Format(time.RFC3339)

	_, err := h.db.Exec(`
		INSERT INTO payment_methods (id, name, type, bank_name, account_name, account_number, qris_image_url, description, fee_type, fee_percentage, fee_fixed, is_active, sort_order, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, name, mType, req.BankName, req.AccountName, req.AccountNumber, req.QRISImageURL, req.Description, feeType, req.FeePercentage, req.FeeFixed, isActive, req.SortOrder, now, now)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "SERVER_ERROR", "message": "Gagal menyimpan metode pembayaran"},
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"id":   id,
			"name": name,
		},
		"message": "Metode pembayaran berhasil ditambahkan",
	})
}

// Update updates an existing payment method
func (h *Handler) Update(c *fiber.Ctx) error {
	id := c.Params("id")
	var req CreateMethodRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "INVALID_BODY", "message": "Format data tidak valid"},
		})
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "VALIDATION_ERROR", "message": "Nama metode pembayaran wajib diisi"},
		})
	}

	mType := strings.TrimSpace(req.Type)
	if mType != "bank_transfer" && mType != "qris" {
		mType = "bank_transfer"
	}

	feeType := strings.TrimSpace(req.FeeType)
	if feeType != "fixed" && feeType != "percentage" && feeType != "mixed" {
		feeType = "fixed"
	}

	isActive := 1
	if req.IsActive != nil && !*req.IsActive {
		isActive = 0
	}

	now := time.Now().UTC().Format(time.RFC3339)

	res, err := h.db.Exec(`
		UPDATE payment_methods
		SET name = ?, type = ?, bank_name = ?, account_name = ?, account_number = ?, qris_image_url = ?, description = ?, fee_type = ?, fee_percentage = ?, fee_fixed = ?, is_active = ?, sort_order = ?, updated_at = ?
		WHERE id = ?
	`, name, mType, req.BankName, req.AccountName, req.AccountNumber, req.QRISImageURL, req.Description, feeType, req.FeePercentage, req.FeeFixed, isActive, req.SortOrder, now, id)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "SERVER_ERROR", "message": "Gagal memperbarui metode pembayaran"},
		})
	}

	rows, _ := res.RowsAffected()
	if rows == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "NOT_FOUND", "message": "Metode pembayaran tidak ditemukan"},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Metode pembayaran berhasil diperbarui",
	})
}

// Delete deletes a payment method if not used in active transactions
func (h *Handler) Delete(c *fiber.Ctx) error {
	id := c.Params("id")

	var txCount int
	_ = h.db.QueryRow("SELECT COUNT(*) FROM transactions WHERE payment_method_id = ?", id).Scan(&txCount)
	if txCount > 0 {
		// Soft deactivate instead of hard delete to keep foreign keys intact
		_, _ = h.db.Exec("UPDATE payment_methods SET is_active = 0, updated_at = ? WHERE id = ?", time.Now().UTC().Format(time.RFC3339), id)
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Metode pembayaran dinonaktifkan karena telah memiliki riwayat transaksi",
		})
	}

	_, err := h.db.Exec("DELETE FROM payment_methods WHERE id = ?", id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "SERVER_ERROR", "message": "Gagal menghapus metode pembayaran"},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Metode pembayaran berhasil dihapus",
	})
}
