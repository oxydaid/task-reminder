package outbox

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"task-reminder/backend/internal/database"
	"task-reminder/backend/internal/whatsapp"
)

type OutboxMessage struct {
	ID             string  `json:"id"`
	RecipientPhone string  `json:"recipient_phone"`
	MessageText    string  `json:"message_text"`
	MediaPath      string  `json:"media_path,omitempty"`
	Status         string  `json:"status"` // pending, sent, failed
	AttemptCount   int     `json:"attempt_count"`
	LastError      string  `json:"last_error,omitempty"`
	DedupKey       string  `json:"dedup_key,omitempty"`
	CreatedAt      string  `json:"created_at"`
	SentAt         *string `json:"sent_at,omitempty"`
}

type Service struct {
	db *database.DB
	wa *whatsapp.Service
}

func NewService(db *database.DB, wa *whatsapp.Service) *Service {
	return &Service{db: db, wa: wa}
}

// Enqueue adds a message to the persistent outbox
func (s *Service) Enqueue(recipientPhone, messageText, mediaPath, dedupKey string) (string, error) {
	now := time.Now().UTC().Format(time.RFC3339)

	if dedupKey != "" {
		var existingID string
		err := s.db.QueryRow("SELECT id FROM message_outbox WHERE dedup_key = ? AND status IN ('pending', 'sent')", dedupKey).Scan(&existingID)
		if err == nil && existingID != "" {
			return existingID, nil // Already enqueued or sent
		}
	}

	id := uuid.New().String()
	_, err := s.db.Exec(`
		INSERT INTO message_outbox (id, recipient_phone, message_text, media_path, status, attempt_count, dedup_key, created_at)
		VALUES (?, ?, ?, ?, 'pending', 0, ?, ?)
	`, id, recipientPhone, messageText, mediaPath, dedupKey, now)
	if err != nil {
		return "", fmt.Errorf("failed to enqueue outbox message: %w", err)
	}

	// Try immediate delivery asynchronously if WhatsApp is ready
	go func() {
		_ = s.DeliverOne(id)
	}()

	return id, nil
}

// DeliverOne attempts sending a single message by ID
func (s *Service) DeliverOne(id string) error {
	var m OutboxMessage
	var sentAt sql.NullString
	err := s.db.QueryRow(`
		SELECT id, recipient_phone, message_text, media_path, status, attempt_count, last_error, dedup_key, created_at, sent_at
		FROM message_outbox WHERE id = ?
	`, id).Scan(&m.ID, &m.RecipientPhone, &m.MessageText, &m.MediaPath, &m.Status, &m.AttemptCount, &m.LastError, &m.DedupKey, &m.CreatedAt, &sentAt)
	if err != nil {
		return err
	}

	if m.Status == "sent" {
		return nil
	}
	if m.AttemptCount >= 3 {
		return nil // Max retry reached
	}

	if s.wa == nil {
		return fmt.Errorf("whatsapp service unavailable")
	}

	status := s.wa.GetStatus()
	if !status.IsConnected || !status.IsLoggedIn {
		return fmt.Errorf("whatsapp bot not connected")
	}

	nowStr := time.Now().UTC().Format(time.RFC3339)
	m.AttemptCount++

	sendErr := s.wa.SendMessage(m.RecipientPhone, m.MessageText)
	if sendErr != nil {
		_, _ = s.db.Exec(`
			UPDATE message_outbox
			SET status = CASE WHEN attempt_count >= 3 THEN 'failed' ELSE 'pending' END,
			    attempt_count = ?, last_error = ?
			WHERE id = ?
		`, m.AttemptCount, sendErr.Error(), m.ID)
		return sendErr
	}

	_, _ = s.db.Exec(`
		UPDATE message_outbox
		SET status = 'sent', attempt_count = ?, last_error = '', sent_at = ?
		WHERE id = ?
	`, m.AttemptCount, nowStr, m.ID)

	return nil
}

// ProcessPending processes any pending messages in the outbox
func (s *Service) ProcessPending() {
	if s.wa == nil {
		return
	}
	status := s.wa.GetStatus()
	if !status.IsConnected || !status.IsLoggedIn {
		return
	}

	rows, err := s.db.Query(`
		SELECT id FROM message_outbox
		WHERE status = 'pending' AND attempt_count < 3
		ORDER BY created_at ASC
		LIMIT 20
	`)
	if err != nil {
		return
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}

	for _, id := range ids {
		if err := s.DeliverOne(id); err != nil {
			log.Printf("[Outbox] Deliver error for %s: %v", id, err)
		}
		time.Sleep(500 * time.Millisecond) // Slight pause between WhatsApp dispatches
	}
}
