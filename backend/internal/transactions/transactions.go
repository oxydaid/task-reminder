package transactions

import (
	"database/sql"
	"fmt"
	"math"
	"math/rand"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"task-reminder/backend/internal/auth"
	"task-reminder/backend/internal/database"
	"task-reminder/backend/internal/outbox"
	"task-reminder/backend/internal/payment_methods"
	"task-reminder/backend/internal/plans"
	"task-reminder/backend/internal/subscriptions"
)

type Transaction struct {
	ID                    string `json:"id"`
	Code                  string `json:"code"`
	UserID                string `json:"user_id"`
	UserName              string `json:"user_name,omitempty"`
	UserPhone             string `json:"user_phone,omitempty"`
	PlanID                string `json:"plan_id"`
	PaymentMethodID       string `json:"payment_method_id"`
	PlanName              string `json:"plan_name"`
	PlanPrice             int    `json:"plan_price"`
	PlanCourseLimit       int    `json:"plan_course_limit"`
	PlanTaskLimit         int    `json:"plan_task_limit"`
	PlanNotificationLimit int    `json:"plan_notification_limit"`
	PaymentMethodName     string `json:"payment_method_name"`
	PaymentMethodType     string `json:"payment_method_type"`
	PaymentMethodDetails  string `json:"payment_method_details"`
	FeeType               string `json:"fee_type"`
	FeePercentage         float64 `json:"fee_percentage"`
	FeeFixed              int    `json:"fee_fixed"`
	FeeAmount             int    `json:"fee_amount"`
	Subtotal              int    `json:"subtotal"`
	TotalAmount           int    `json:"total_amount"`
	Status                string `json:"status"` // pending_payment, waiting_verification, paid, rejected, cancelled, expired
	ExpiresAt             string `json:"expires_at"`
	PaidAt                *string `json:"paid_at,omitempty"`
	VerifiedBy            string `json:"verified_by,omitempty"`
	AdminNotes            string `json:"admin_notes,omitempty"`
	RejectionReason       string `json:"rejection_reason,omitempty"`
	CreatedAt             string `json:"created_at"`
	UpdatedAt             string `json:"updated_at"`
	Proofs                []PaymentProof `json:"proofs,omitempty"`
	BankName              string `json:"bank_name,omitempty"`
	AccountName           string `json:"account_name,omitempty"`
	AccountNumber         string `json:"account_number,omitempty"`
	QRISImageURL          string `json:"qris_image_url,omitempty"`
}

type PaymentProof struct {
	ID            string `json:"id"`
	TransactionID string `json:"transaction_id"`
	UserID        string `json:"user_id"`
	FilePath      string `json:"file_path"`
	FileName      string `json:"file_name"`
	FileSize      int64  `json:"file_size"`
	MimeType      string `json:"mime_type"`
	Source        string `json:"source"`
	Notes         string `json:"notes,omitempty"`
	CreatedAt     string `json:"created_at"`
}

type CheckoutRequest struct {
	PlanID          string `json:"plan_id"`
	PaymentMethodID string `json:"payment_method_id"`
	IdempotencyKey  string `json:"idempotency_key,omitempty"`
}

type UploadProofRequest struct {
	FilePath string `json:"file_path"`
	FileName string `json:"file_name"`
	FileSize int64  `json:"file_size"`
	MimeType string `json:"mime_type"`
	Notes    string `json:"notes,omitempty"`
}

type Handler struct {
	db      *database.DB
	outbox  *outbox.Service
	subSvc  *subscriptions.Service
}

func NewHandler(db *database.DB, outbox *outbox.Service, subSvc *subscriptions.Service) *Handler {
	return &Handler{db: db, outbox: outbox, subSvc: subSvc}
}

// Checkout creates a new manual payment transaction
func (h *Handler) Checkout(c *fiber.Ctx) error {
	user := c.Locals("user").(*auth.User)

	var req CheckoutRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "INVALID_BODY", "message": "Format data tidak valid"},
		})
	}

	if req.PlanID == "" || req.PaymentMethodID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "VALIDATION_ERROR", "message": "Paket dan metode pembayaran wajib dipilih"},
		})
	}

	// Check idempotency if provided
	if req.IdempotencyKey != "" {
		var existingID, existingCode string
		err := h.db.QueryRow("SELECT id, code FROM transactions WHERE idempotency_key = ? AND user_id = ?", req.IdempotencyKey, user.ID).Scan(&existingID, &existingCode)
		if err == nil && existingID != "" {
			return c.JSON(fiber.Map{
				"success": true,
				"data": fiber.Map{
					"id":   existingID,
					"code": existingCode,
				},
				"message": "Transaksi sebelumnya dikembalikan (idempotent)",
			})
		}
	}

	// 1. Fetch Plan
	var plan plans.Plan
	var pDesc sql.NullString
	err := h.db.QueryRow(`
		SELECT id, name, slug, description, price, course_limit, task_limit, notification_limit, is_active
		FROM plans WHERE id = ?
	`, req.PlanID).Scan(&plan.ID, &plan.Name, &plan.Slug, &pDesc, &plan.Price, &plan.CourseLimit, &plan.TaskLimit, &plan.NotificationLimit, &plan.IsActive)
	if err != nil || !plan.IsActive {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "INVALID_PLAN", "message": "Paket tidak valid atau sedang tidak aktif"},
		})
	}
	if plan.Price <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "FREE_PLAN", "message": "Paket gratis tidak memerlukan transaksi pembayaran"},
		})
	}

	// 2. Fetch Payment Method
	var pm payment_methods.PaymentMethod
	var bName, aName, aNum, qrisUrl, pmDesc sql.NullString
	var actInt int
	err = h.db.QueryRow(`
		SELECT id, name, type, bank_name, account_name, account_number, qris_image_url, description, fee_type, fee_percentage, fee_fixed, is_active
		FROM payment_methods WHERE id = ?
	`, req.PaymentMethodID).Scan(&pm.ID, &pm.Name, &pm.Type, &bName, &aName, &aNum, &qrisUrl, &pmDesc, &pm.FeeType, &pm.FeePercentage, &pm.FeeFixed, &actInt)
	if err != nil || actInt != 1 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "INVALID_PAYMENT_METHOD", "message": "Metode pembayaran tidak valid atau sedang dinonaktifkan"},
		})
	}
	pm.BankName = bName.String
	pm.AccountName = aName.String
	pm.AccountNumber = aNum.String
	pm.QRISImageURL = qrisUrl.String

	// 3. Calculate Fee & Total
	subtotal := plan.Price
	feeAmount := 0
	switch pm.FeeType {
	case "fixed":
		feeAmount = pm.FeeFixed
	case "percentage":
		feeAmount = int(math.Round(float64(subtotal) * (pm.FeePercentage / 100.0)))
	case "mixed":
		pctFee := int(math.Round(float64(subtotal) * (pm.FeePercentage / 100.0)))
		feeAmount = pctFee + pm.FeeFixed
	default:
		feeAmount = 0
	}
	totalAmount := subtotal + feeAmount

	// 4. Generate Unique Code
	now := time.Now().UTC()
	dateStr := now.Format("20060102")
	randomNum := rand.Intn(90000) + 10000
	code := fmt.Sprintf("TRX-%s-%d", dateStr, randomNum)

	// Build Payment Details snapshot
	var detailsSnapshot string
	if pm.Type == "bank_transfer" {
		detailsSnapshot = fmt.Sprintf("Bank: %s | No. Rekening: %s | Atas Nama: %s", pm.BankName, pm.AccountNumber, pm.AccountName)
	} else {
		detailsSnapshot = fmt.Sprintf("QRIS: %s | Penerima: %s", pm.QRISImageURL, pm.AccountName)
	}

	txID := uuid.New().String()
	nowStr := now.Format(time.RFC3339)
	expiresAt := now.Add(24 * time.Hour).Format(time.RFC3339)

	// 5. Insert Transaction
	tx, err := h.db.Begin()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "SERVER_ERROR", "message": "Gagal memulai transaksi database"},
		})
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO transactions (
			id, code, user_id, plan_id, payment_method_id,
			plan_name, plan_price, plan_course_limit, plan_task_limit, plan_notification_limit,
			payment_method_name, payment_method_type, payment_method_details,
			fee_type, fee_percentage, fee_fixed, fee_amount, subtotal, total_amount,
			status, expires_at, idempotency_key, created_at, updated_at
		) VALUES (
			?, ?, ?, ?, ?,
			?, ?, ?, ?, ?,
			?, ?, ?,
			?, ?, ?, ?, ?, ?,
			'pending_payment', ?, ?, ?, ?
		)
	`,
		txID, code, user.ID, plan.ID, pm.ID,
		plan.Name, plan.Price, plan.CourseLimit, plan.TaskLimit, plan.NotificationLimit,
		pm.Name, pm.Type, detailsSnapshot,
		pm.FeeType, pm.FeePercentage, pm.FeeFixed, feeAmount, subtotal, totalAmount,
		expiresAt, req.IdempotencyKey, nowStr, nowStr,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "SERVER_ERROR", "message": "Gagal membuat transaksi: " + err.Error()},
		})
	}

	// Insert transaction log
	logID := uuid.New().String()
	_, _ = tx.Exec(`
		INSERT INTO transaction_logs (id, transaction_id, action, previous_status, new_status, actor_id, actor_role, notes, created_at)
		VALUES (?, ?, 'created', '', 'pending_payment', ?, 'user', 'Checkout dibuat oleh user', ?)
	`, logID, txID, user.ID, nowStr)

	if err := tx.Commit(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "SERVER_ERROR", "message": "Gagal menyimpan transaksi"},
		})
	}

	// 6. Send WhatsApp Payment Instructions & Admin Notification asynchronously
	// This decouples outbox queuing from the HTTP response, guaranteeing instant checkout return
	go func() {
		if h.outbox != nil && user.WhatsAppNumber != "" {
			var paymentInstruction string
			if pm.Type == "bank_transfer" {
				paymentInstruction = fmt.Sprintf("Silakan lakukan transfer ke:\n🏦 *Bank:* %s\n💳 *No. Rekening:* %s\n👤 *Atas Nama:* %s", pm.BankName, pm.AccountNumber, pm.AccountName)
			} else {
				paymentInstruction = fmt.Sprintf("Silakan lakukan pembayaran via *QRIS* (%s).\nAnda dapat memindai barcode QRIS langsung di halaman detail transaksi web.", pm.AccountName)
			}

			msg := fmt.Sprintf(`Halo %s! 👋 Terima kasih telah memilih Task Reminder.

*Instruksi Pembayaran Langganan*
📋 *Kode Transaksi:* %s
📦 *Paket:* %s
💰 *Harga Paket:* Rp%s
🏷️ *Biaya Admin:* Rp%s
💳 *Total Pembayaran:* *Rp%s*

%s

Setelah transfer berhasil, harap unggah foto bukti transfer di dashboard web Task Reminder untuk diverifikasi oleh Admin.
⏱️ *Batas Waktu Pembayaran:* 24 Jam. Terima kasih! 🙏`,
				user.Name, code, plan.Name, formatRupiah(subtotal), formatRupiah(feeAmount), formatRupiah(totalAmount), paymentInstruction)

			dedupKey := fmt.Sprintf("tx_checkout_%s", txID)
			_, _ = h.outbox.Enqueue(user.WhatsAppNumber, msg, "", dedupKey)
		}

		// 7. Notify Admins if enabled
		h.notifyAdminsNewTransaction(code, user.Name, user.WhatsAppNumber, plan.Name, totalAmount)
	}()

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"id":                     txID,
			"code":                   code,
			"plan_name":              plan.Name,
			"plan_price":             plan.Price,
			"payment_method_name":    pm.Name,
			"payment_method_type":    pm.Type,
			"payment_method_details": detailsSnapshot,
			"bank_name":              pm.BankName,
			"account_name":           pm.AccountName,
			"account_number":         pm.AccountNumber,
			"qris_image_url":         pm.QRISImageURL,
			"subtotal":               subtotal,
			"fee_amount":             feeAmount,
			"total_amount":           totalAmount,
			"status":                 "pending_payment",
			"expires_at":             expiresAt,
			"created_at":             nowStr,
		},
		"message": "Transaksi berhasil dibuat",
	})
}

// UploadProof uploads payment proof for a transaction
func (h *Handler) UploadProof(c *fiber.Ctx) error {
	user := c.Locals("user").(*auth.User)
	txID := c.Params("id")

	var req UploadProofRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "INVALID_BODY", "message": "Format data tidak valid"},
		})
	}

	if req.FilePath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "VALIDATION_ERROR", "message": "File bukti pembayaran wajib disertakan"},
		})
	}

	// Validate transaction ownership and status
	var currentStatus, code, planName string
	var totalAmount int
	err := h.db.QueryRow("SELECT status, code, plan_name, total_amount FROM transactions WHERE id = ? AND user_id = ?", txID, user.ID).Scan(&currentStatus, &code, &planName, &totalAmount)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "NOT_FOUND", "message": "Transaksi tidak ditemukan"},
		})
	}

	if currentStatus != "pending_payment" && currentStatus != "waiting_verification" && currentStatus != "rejected" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "INVALID_STATUS", "message": "Bukti pembayaran tidak dapat diunggah untuk status transaksi saat ini"},
		})
	}

	proofID := uuid.New().String()
	nowStr := time.Now().UTC().Format(time.RFC3339)

	tx, err := h.db.Begin()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "SERVER_ERROR", "message": "Gagal memulai transaksi database"},
		})
	}
	defer tx.Rollback()

	// Insert proof
	_, err = tx.Exec(`
		INSERT INTO payment_proofs (id, transaction_id, user_id, file_path, file_name, file_size, mime_type, source, notes, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, 'web', ?, ?)
	`, proofID, txID, user.ID, req.FilePath, req.FileName, req.FileSize, req.MimeType, req.Notes, nowStr)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "SERVER_ERROR", "message": "Gagal menyimpan bukti pembayaran"},
		})
	}

	// Update transaction status to waiting_verification
	_, err = tx.Exec(`
		UPDATE transactions
		SET status = 'waiting_verification', updated_at = ?
		WHERE id = ?
	`, nowStr, txID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "SERVER_ERROR", "message": "Gagal memperbarui status transaksi"},
		})
	}

	// Insert transaction log
	logID := uuid.New().String()
	_, _ = tx.Exec(`
		INSERT INTO transaction_logs (id, transaction_id, action, previous_status, new_status, actor_id, actor_role, notes, created_at)
		VALUES (?, ?, 'proof_uploaded', ?, 'waiting_verification', ?, 'user', 'Bukti pembayaran diunggah oleh user', ?)
	`, logID, txID, currentStatus, user.ID, nowStr)

	if err := tx.Commit(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "SERVER_ERROR", "message": "Gagal menyimpan data"},
		})
	}

	// Notify admins in background goroutine to keep client response swift
	go func() {
		h.notifyAdminsPaymentProof(code, user.Name, user.WhatsAppNumber, planName, totalAmount)
	}()

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"id":             proofID,
			"transaction_id": txID,
			"file_path":      req.FilePath,
			"file_name":      req.FileName,
			"file_size":      req.FileSize,
			"status":         "waiting_verification",
		},
		"message": "Bukti pembayaran berhasil diunggah. Mohon tunggu verifikasi admin.",
	})
}

// ListUser returns user's transactions
func (h *Handler) ListUser(c *fiber.Ctx) error {
	user := c.Locals("user").(*auth.User)

	rows, err := h.db.Query(`
		SELECT id, code, plan_name, plan_price, payment_method_name, payment_method_type,
		       fee_amount, subtotal, total_amount, status, expires_at, created_at
		FROM transactions
		WHERE user_id = ?
		ORDER BY created_at DESC
	`, user.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "SERVER_ERROR", "message": "Gagal mengambil daftar transaksi"},
		})
	}
	defer rows.Close()

	list := make([]fiber.Map, 0)
	for rows.Next() {
		var id, code, pName, pmName, pmType, status, expAt, createdAt string
		var pPrice, fee, subtotal, total int
		if err := rows.Scan(&id, &code, &pName, &pPrice, &pmName, &pmType, &fee, &subtotal, &total, &status, &expAt, &createdAt); err == nil {
			list = append(list, fiber.Map{
				"id":                  id,
				"code":                code,
				"plan_name":           pName,
				"plan_price":          pPrice,
				"payment_method_name": pmName,
				"payment_method_type": pmType,
				"fee_amount":          fee,
				"subtotal":            subtotal,
				"total_amount":        total,
				"status":              status,
				"expires_at":          expAt,
				"created_at":          createdAt,
			})
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    list,
	})
}

// GetByID returns transaction details
func (h *Handler) GetByID(c *fiber.Ctx) error {
	user := c.Locals("user").(*auth.User)
	txID := c.Params("id")

	query := `
		SELECT t.id, t.code, t.user_id, u.name as user_name, u.whatsapp_number as user_phone,
		       t.plan_id, t.payment_method_id, t.plan_name, t.plan_price, t.plan_course_limit, t.plan_task_limit, t.plan_notification_limit,
		       t.payment_method_name, t.payment_method_type, t.payment_method_details,
		       t.fee_type, t.fee_percentage, t.fee_fixed, t.fee_amount, t.subtotal, t.total_amount,
		       t.status, t.expires_at, t.paid_at, t.verified_by, t.admin_notes, t.rejection_reason, t.created_at, t.updated_at,
		       COALESCE(pm.bank_name, ''), COALESCE(pm.account_name, ''), COALESCE(pm.account_number, ''), COALESCE(pm.qris_image_url, '')
		FROM transactions t
		JOIN users u ON t.user_id = u.id
		LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
		WHERE t.id = ?
	`
	args := []interface{}{txID}
	if user.Role != "admin" {
		query += " AND t.user_id = ?"
		args = append(args, user.ID)
	}

	var tx Transaction
	var paidAt, verifiedBy, adminNotes, rejReason sql.NullString
	var bName, aName, aNum, qrisUrl string

	err := h.db.QueryRow(query, args...).Scan(
		&tx.ID, &tx.Code, &tx.UserID, &tx.UserName, &tx.UserPhone,
		&tx.PlanID, &tx.PaymentMethodID, &tx.PlanName, &tx.PlanPrice, &tx.PlanCourseLimit, &tx.PlanTaskLimit, &tx.PlanNotificationLimit,
		&tx.PaymentMethodName, &tx.PaymentMethodType, &tx.PaymentMethodDetails,
		&tx.FeeType, &tx.FeePercentage, &tx.FeeFixed, &tx.FeeAmount, &tx.Subtotal, &tx.TotalAmount,
		&tx.Status, &tx.ExpiresAt, &paidAt, &verifiedBy, &adminNotes, &rejReason, &tx.CreatedAt, &tx.UpdatedAt,
		&bName, &aName, &aNum, &qrisUrl,
	)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "NOT_FOUND", "message": "Transaksi tidak ditemukan"},
		})
	}

	tx.BankName = bName
	tx.AccountName = aName
	tx.AccountNumber = aNum
	tx.QRISImageURL = qrisUrl

	if paidAt.Valid {
		tx.PaidAt = &paidAt.String
	}
	tx.VerifiedBy = verifiedBy.String
	tx.AdminNotes = adminNotes.String
	tx.RejectionReason = rejReason.String

	// Load proofs
	proofRows, err := h.db.Query(`
		SELECT id, transaction_id, user_id, file_path, file_name, file_size, mime_type, source, notes, created_at
		FROM payment_proofs WHERE transaction_id = ? ORDER BY created_at DESC
	`, txID)
	if err == nil {
		defer proofRows.Close()
		tx.Proofs = make([]PaymentProof, 0)
		for proofRows.Next() {
			var p PaymentProof
			var notes sql.NullString
			if err := proofRows.Scan(&p.ID, &p.TransactionID, &p.UserID, &p.FilePath, &p.FileName, &p.FileSize, &p.MimeType, &p.Source, &notes, &p.CreatedAt); err == nil {
				p.Notes = notes.String
				tx.Proofs = append(tx.Proofs, p)
			}
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    tx,
	})
}

// Admin Handlers

// ListAdmin lists transactions with filter and search
func (h *Handler) ListAdmin(c *fiber.Ctx) error {
	statusFilter := c.Query("status")
	search := strings.TrimSpace(c.Query("search"))

	query := `
		SELECT t.id, t.code, t.user_id, u.name as user_name, u.whatsapp_number as user_phone,
		       t.plan_name, t.payment_method_name, t.total_amount, t.status, t.created_at, t.expires_at
		FROM transactions t
		JOIN users u ON t.user_id = u.id
		WHERE 1=1
	`
	args := make([]interface{}, 0)

	if statusFilter != "" && statusFilter != "all" {
		query += " AND t.status = ?"
		args = append(args, statusFilter)
	}

	if search != "" {
		query += " AND (t.code LIKE ? OR u.name LIKE ? OR u.whatsapp_number LIKE ?)"
		searchArg := "%" + search + "%"
		args = append(args, searchArg, searchArg, searchArg)
	}

	query += " ORDER BY t.created_at DESC LIMIT 100"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "SERVER_ERROR", "message": "Gagal mengambil daftar transaksi"},
		})
	}
	defer rows.Close()

	list := make([]fiber.Map, 0)
	for rows.Next() {
		var id, code, uID, uName, uPhone, pName, pmName, status, createdAt, expAt string
		var total int
		if err := rows.Scan(&id, &code, &uID, &uName, &uPhone, &pName, &pmName, &total, &status, &createdAt, &expAt); err == nil {
			list = append(list, fiber.Map{
				"id":                  id,
				"code":                code,
				"user_id":             uID,
				"user_name":           uName,
				"user_phone":          uPhone,
				"plan_name":           pName,
				"payment_method_name": pmName,
				"total_amount":        total,
				"status":              status,
				"created_at":          createdAt,
				"expires_at":          expAt,
			})
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    list,
	})
}

// Approve approves transaction, activates/extends subscription in atomic DB transaction
func (h *Handler) Approve(c *fiber.Ctx) error {
	admin := c.Locals("user").(*auth.User)
	txID := c.Params("id")

	var req struct {
		Notes string `json:"notes"`
	}
	_ = c.BodyParser(&req)

	now := time.Now().UTC()
	nowStr := now.Format(time.RFC3339)

	dbTx, err := h.db.Begin()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal memulai transaksi database"}})
	}
	defer dbTx.Rollback()

	// 1. Fetch transaction
	var code, userID, planID, planName, status string
	var totalAmount int
	err = dbTx.QueryRow(`
		SELECT code, user_id, plan_id, plan_name, total_amount, status
		FROM transactions WHERE id = ?
	`, txID).Scan(&code, &userID, &planID, &planName, &totalAmount, &status)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "NOT_FOUND", "message": "Transaksi tidak ditemukan"}})
	}

	if status == "paid" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "ALREADY_PAID", "message": "Transaksi sudah disetujui sebelumnya"}})
	}
	if status == "cancelled" || status == "expired" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "INVALID_STATUS", "message": "Transaksi telah dibatalkan atau kedaluwarsa"}})
	}

	// 2. Update transaction status
	_, err = dbTx.Exec(`
		UPDATE transactions
		SET status = 'paid', paid_at = ?, verified_by = ?, admin_notes = ?, updated_at = ?
		WHERE id = ?
	`, nowStr, admin.ID, req.Notes, nowStr, txID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal memperbarui status transaksi"}})
	}

	// 3. Log to transaction_logs
	logID := uuid.New().String()
	_, _ = dbTx.Exec(`
		INSERT INTO transaction_logs (id, transaction_id, action, previous_status, new_status, actor_id, actor_role, notes, created_at)
		VALUES (?, ?, 'approved', ?, 'paid', ?, 'admin', ?, ?)
	`, logID, txID, status, admin.ID, req.Notes, nowStr)

	// 4. Activate or Extend Subscription
	// Check if user has an existing active subscription with the SAME plan
	var activeSubID, activePlanID string
	var currentExpiresAt sql.NullString
	_ = dbTx.QueryRow(`
		SELECT id, plan_id, expires_at FROM subscriptions
		WHERE user_id = ? AND status = 'active'
		ORDER BY created_at DESC LIMIT 1
	`, userID).Scan(&activeSubID, &activePlanID, &currentExpiresAt)

	var newExpiresAt string
	if activeSubID != "" && activePlanID == planID && currentExpiresAt.Valid {
		// Same plan perpanjangan: add 1 month from existing expiration (Section 4.5)
		curExp, parseErr := time.Parse(time.RFC3339, currentExpiresAt.String)
		if parseErr == nil && curExp.After(now) {
			newExpiresAt = curExp.AddDate(0, 1, 0).Format(time.RFC3339)
		} else {
			newExpiresAt = now.AddDate(0, 1, 0).Format(time.RFC3339)
		}

		_, err = dbTx.Exec(`
			UPDATE subscriptions
			SET expires_at = ?, updated_at = ?
			WHERE id = ?
		`, newExpiresAt, nowStr, activeSubID)
	} else {
		// New or Upgrade plan: start new 1 month subscription from now
		newExpiresAt = now.AddDate(0, 1, 0).Format(time.RFC3339)

		// Cancel any previous active subscriptions
		_, _ = dbTx.Exec("UPDATE subscriptions SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE user_id = ? AND status = 'active'", nowStr, nowStr, userID)

		subID := uuid.New().String()
		_, err = dbTx.Exec(`
			INSERT INTO subscriptions (id, user_id, plan_id, status, subscription_type, started_at, expires_at, activated_at, created_at, updated_at)
			VALUES (?, ?, ?, 'active', 'paid', ?, ?, ?, ?, ?)
		`, subID, userID, planID, nowStr, newExpiresAt, nowStr, nowStr, nowStr)
		activeSubID = subID
	}

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal mengaktifkan langganan"}})
	}

	// 5. Log to subscription_logs
	subLogID := uuid.New().String()
	_, _ = dbTx.Exec(`
		INSERT INTO subscription_logs (id, subscription_id, user_id, action, new_plan_id, admin_id, reason, created_at)
		VALUES (?, ?, ?, 'paid_activated', ?, ?, 'Pembayaran diverifikasi oleh admin', ?)
	`, subLogID, activeSubID, userID, planID, admin.ID, nowStr)

	if err := dbTx.Commit(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal menyimpan perubahan transaksi"}})
	}

	// 6. Send WhatsApp confirmation to user
	var userPhone, userName string
	_ = h.db.QueryRow("SELECT whatsapp_number, name FROM users WHERE id = ?", userID).Scan(&userPhone, &userName)
	if userPhone != "" && h.outbox != nil {
		msg := fmt.Sprintf(`Halo %s! 🎉 Selamat, pembayaran kamu untuk transaksi *%s* telah diverifikasi dan disetujui!

Paket langganan *%s* kini aktif hingga: *%s*.
Nikmati batas tugas dan mata kuliah yang lebih luas serta notifikasi WhatsApp otomatis di Task Reminder. Sukses selalu untuk kuliahnya! 💪`, userName, code, planName, newExpiresAt[:10])
		_, _ = h.outbox.Enqueue(userPhone, msg, "", fmt.Sprintf("tx_approved_%s", txID))
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": fmt.Sprintf("Transaksi %s berhasil disetujui dan paket %s telah aktif", code, planName),
	})
}

// Reject rejects transaction with reason
func (h *Handler) Reject(c *fiber.Ctx) error {
	admin := c.Locals("user").(*auth.User)
	txID := c.Params("id")

	var req struct {
		Reason string `json:"reason"`
	}
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Reason) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "VALIDATION_ERROR", "message": "Alasan penolakan pembayaran wajib diisi"},
		})
	}

	nowStr := time.Now().UTC().Format(time.RFC3339)

	var code, userID, planName, currentStatus string
	err := h.db.QueryRow("SELECT code, user_id, plan_name, status FROM transactions WHERE id = ?", txID).Scan(&code, &userID, &planName, &currentStatus)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "NOT_FOUND", "message": "Transaksi tidak ditemukan"}})
	}

	if currentStatus == "paid" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "ALREADY_PAID", "message": "Transaksi yang sudah disetujui tidak dapat ditolak"}})
	}

	tx, err := h.db.Begin()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal memulai transaksi database"}})
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		UPDATE transactions
		SET status = 'rejected', rejection_reason = ?, verified_by = ?, updated_at = ?
		WHERE id = ?
	`, req.Reason, admin.ID, nowStr, txID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal memperbarui status"}})
	}

	logID := uuid.New().String()
	_, _ = tx.Exec(`
		INSERT INTO transaction_logs (id, transaction_id, action, previous_status, new_status, actor_id, actor_role, notes, created_at)
		VALUES (?, ?, 'rejected', ?, 'rejected', ?, 'admin', ?, ?)
	`, logID, txID, currentStatus, admin.ID, req.Reason, nowStr)

	if err := tx.Commit(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal menyimpan data"}})
	}

	// Send WhatsApp notification to user
	var userPhone, userName string
	_ = h.db.QueryRow("SELECT whatsapp_number, name FROM users WHERE id = ?", userID).Scan(&userPhone, &userName)
	if userPhone != "" && h.outbox != nil {
		msg := fmt.Sprintf(`Halo %s. ⚠️ Mohon maaf, bukti pembayaran untuk transaksi *%s* (Paket %s) tidak dapat disetujui.

*Alasan Penolakan:*
%s

Jika ada kendala atau Anda ingin mengunggah bukti pembayaran yang benar, silakan kunjungi halaman detail transaksi di web Task Reminder. Terima kasih.`, userName, code, planName, req.Reason)
		_, _ = h.outbox.Enqueue(userPhone, msg, "", fmt.Sprintf("tx_rejected_%s", txID))
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Pembayaran transaksi berhasil ditolak",
	})
}

// Cancel cancels a pending transaction
func (h *Handler) Cancel(c *fiber.Ctx) error {
	user := c.Locals("user").(*auth.User)
	txID := c.Params("id")

	query := "SELECT status, code FROM transactions WHERE id = ?"
	args := []interface{}{txID}
	if user.Role != "admin" {
		query += " AND user_id = ?"
		args = append(args, user.ID)
	}

	var status, code string
	err := h.db.QueryRow(query, args...).Scan(&status, &code)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "NOT_FOUND", "message": "Transaksi tidak ditemukan"}})
	}

	if status != "pending_payment" && status != "waiting_verification" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "CANNOT_CANCEL", "message": "Hanya transaksi pending yang dapat dibatalkan"}})
	}

	nowStr := time.Now().UTC().Format(time.RFC3339)
	_, _ = h.db.Exec("UPDATE transactions SET status = 'cancelled', updated_at = ? WHERE id = ?", nowStr, txID)

	logID := uuid.New().String()
	_, _ = h.db.Exec(`
		INSERT INTO transaction_logs (id, transaction_id, action, previous_status, new_status, actor_id, actor_role, notes, created_at)
		VALUES (?, ?, 'cancelled', ?, 'cancelled', ?, ?, 'Dibatalkan', ?)
	`, logID, txID, status, user.ID, user.Role, nowStr)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Transaksi berhasil dibatalkan",
	})
}

// Notification helpers

func (h *Handler) notifyAdminsNewTransaction(code, userName, userPhone, planName string, total int) {
	if h.outbox == nil {
		return
	}
	rows, err := h.db.Query(`
		SELECT u.whatsapp_number, u.name
		FROM admin_notification_settings ans
		JOIN users u ON ans.admin_id = u.id
		WHERE ans.receive_transaction_notification = 1 AND u.role = 'admin' AND u.is_active = 1
	`)
	if err != nil {
		return
	}

	type adminRecipient struct {
		phone string
		name  string
	}
	var admins []adminRecipient
	for rows.Next() {
		var a adminRecipient
		if err := rows.Scan(&a.phone, &a.name); err == nil && a.phone != "" {
			admins = append(admins, a)
		}
	}
	rows.Close() // Explicitly release DB connection before enqueuing to prevent pool deadlocks

	msg := fmt.Sprintf(`🔔 *Notifikasi Transaksi Baru (Admin)*

Terdapat transaksi baru dibuat:
• *Kode:* %s
• *User:* %s (%s)
• *Paket:* %s
• *Total:* Rp%s

Menunggu transfer dari user.`, code, userName, userPhone, planName, formatRupiah(total))

	for _, a := range admins {
		dedup := fmt.Sprintf("admin_new_tx_%s_%s", code, a.phone)
		_, _ = h.outbox.Enqueue(a.phone, msg, "", dedup)
	}
}

func (h *Handler) notifyAdminsPaymentProof(code, userName, userPhone, planName string, total int) {
	if h.outbox == nil {
		return
	}
	rows, err := h.db.Query(`
		SELECT u.whatsapp_number, u.name
		FROM admin_notification_settings ans
		JOIN users u ON ans.admin_id = u.id
		WHERE ans.receive_payment_proof_notification = 1 AND u.role = 'admin' AND u.is_active = 1
	`)
	if err != nil {
		return
	}

	type adminRecipient struct {
		phone string
		name  string
	}
	var admins []adminRecipient
	for rows.Next() {
		var a adminRecipient
		if err := rows.Scan(&a.phone, &a.name); err == nil && a.phone != "" {
			admins = append(admins, a)
		}
	}
	rows.Close() // Explicitly release DB connection before enqueuing to prevent pool deadlocks

	msg := fmt.Sprintf(`📥 *Bukti Pembayaran Baru (Admin)*

User telah mengunggah bukti pembayaran:
• *Kode:* %s
• *User:* %s (%s)
• *Paket:* %s
• *Total:* Rp%s

Silakan tinjau dan verifikasi pembayaran di dashboard admin Task Reminder!`, code, userName, userPhone, planName, formatRupiah(total))

	for _, a := range admins {
		dedup := fmt.Sprintf("admin_proof_%s_%s", code, a.phone)
		_, _ = h.outbox.Enqueue(a.phone, msg, "", dedup)
	}
}

func formatRupiah(val int) string {
	str := fmt.Sprintf("%d", val)
	n := len(str)
	if n <= 3 {
		return str
	}
	var res []byte
	for i, c := range str {
		if i > 0 && (n-i)%3 == 0 {
			res = append(res, '.')
		}
		res = append(res, byte(c))
	}
	return string(res)
}
