package admin_settings

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"task-reminder/backend/internal/auth"
	"task-reminder/backend/internal/database"
)

type AdminNotificationSettings struct {
	AdminID                         string `json:"admin_id"`
	ReceiveTransactionNotification  bool   `json:"receive_transaction_notification"`
	ReceivePaymentProofNotification bool   `json:"receive_payment_proof_notification"`
	UpdatedAt                       string `json:"updated_at"`
}

type Handler struct {
	db *database.DB
}

func NewHandler(db *database.DB) *Handler {
	return &Handler{db: db}
}

func (h *Handler) GetSettings(c *fiber.Ctx) error {
	admin := c.Locals("user").(*auth.User)

	var receiveTx, receiveProof int
	var updatedAt string

	err := h.db.QueryRow(`
		SELECT receive_transaction_notification, receive_payment_proof_notification, updated_at
		FROM admin_notification_settings
		WHERE admin_id = ?
	`, admin.ID).Scan(&receiveTx, &receiveProof, &updatedAt)

	if err != nil {
		// Insert default row
		nowStr := time.Now().UTC().Format(time.RFC3339)
		_, _ = h.db.Exec(`
			INSERT OR IGNORE INTO admin_notification_settings (admin_id, receive_transaction_notification, receive_payment_proof_notification, updated_at)
			VALUES (?, 1, 1, ?)
		`, admin.ID, nowStr)
		receiveTx = 1
		receiveProof = 1
		updatedAt = nowStr
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": AdminNotificationSettings{
			AdminID:                         admin.ID,
			ReceiveTransactionNotification:  receiveTx == 1,
			ReceivePaymentProofNotification: receiveProof == 1,
			UpdatedAt:                       updatedAt,
		},
	})
}

func (h *Handler) UpdateSettings(c *fiber.Ctx) error {
	admin := c.Locals("user").(*auth.User)

	var req struct {
		ReceiveTransactionNotification  bool `json:"receive_transaction_notification"`
		ReceivePaymentProofNotification bool `json:"receive_payment_proof_notification"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "INVALID_BODY", "message": "Format data tidak valid"},
		})
	}

	nowStr := time.Now().UTC().Format(time.RFC3339)
	rxTx := 0
	if req.ReceiveTransactionNotification {
		rxTx = 1
	}
	rxProof := 0
	if req.ReceivePaymentProofNotification {
		rxProof = 1
	}

	_, err := h.db.Exec(`
		INSERT INTO admin_notification_settings (admin_id, receive_transaction_notification, receive_payment_proof_notification, updated_at)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(admin_id) DO UPDATE SET
			receive_transaction_notification = excluded.receive_transaction_notification,
			receive_payment_proof_notification = excluded.receive_payment_proof_notification,
			updated_at = excluded.updated_at
	`, admin.ID, rxTx, rxProof, nowStr)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "SERVER_ERROR", "message": "Gagal menyimpan pengaturan notifikasi"},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Pengaturan notifikasi admin berhasil diperbarui",
	})
}
