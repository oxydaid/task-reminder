package whatsapp

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
	_ "modernc.org/sqlite"
	"task-reminder/backend/internal/utils"
)

type StatusResponse struct {
	IsConnected   bool   `json:"is_connected"`
	IsLoggedIn    bool   `json:"is_logged_in"`
	PhoneNumber   string `json:"phone_number,omitempty"`
	QRCode        string `json:"qr_code,omitempty"`
	QRCodeImage   string `json:"qr_code_image,omitempty"`
	LastError     string `json:"last_error,omitempty"`
	LastConnected string `json:"last_connected,omitempty"`
}

type Service struct {
	mu            sync.RWMutex
	client        *whatsmeow.Client
	container     *sqlstore.Container
	storePath     string
	qrCode        string
	qrImage       string
	lastError     string
	lastConnected string
	isPairing     bool
}

func NewService(storePath string) (*Service, error) {
	dir := filepath.Dir(storePath)
	if dir != "" && dir != "." {
		_ = os.MkdirAll(dir, 0755)
	}

	dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)", storePath)
	container, err := sqlstore.New(context.Background(), "sqlite", dsn, waLog.Noop)
	if err != nil {
		return nil, fmt.Errorf("failed to create whatsmeow sqlstore: %w", err)
	}

	deviceStore, err := container.GetFirstDevice(context.Background())
	if err != nil {
		return nil, fmt.Errorf("failed to get whatsmeow device: %w", err)
	}

	client := whatsmeow.NewClient(deviceStore, waLog.Noop)

	svc := &Service{
		client:    client,
		container: container,
		storePath: storePath,
	}

	client.AddEventHandler(svc.handleEvent)

	return svc, nil
}

func (s *Service) handleEvent(evt interface{}) {
	switch evt.(type) {
	case *events.Connected:
		s.mu.Lock()
		s.lastConnected = time.Now().Format(time.RFC3339)
		s.lastError = ""
		s.qrCode = ""
		s.qrImage = ""
		s.mu.Unlock()
	case *events.LoggedOut:
		s.mu.Lock()
		s.qrCode = ""
		s.qrImage = ""
		s.lastError = "Koneksi WhatsApp telah logout"
		s.mu.Unlock()
	case *events.Disconnected:
		s.mu.Lock()
		s.mu.Unlock()
	}
}

func (s *Service) AutoConnect() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.client == nil {
		return errors.New("client belum diinisialisasi")
	}

	if s.client.Store.ID != nil {
		// Existing session
		err := s.client.Connect()
		if err != nil {
			s.lastError = err.Error()
			return err
		}
		s.lastConnected = time.Now().Format(time.RFC3339)
		s.lastError = ""
	}
	return nil
}

func (s *Service) Pair() error {
	s.mu.Lock()
	if s.isPairing {
		s.mu.Unlock()
		return nil
	}
	s.isPairing = true
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.isPairing = false
		s.mu.Unlock()
	}()

	if s.client.IsConnected() {
		s.client.Disconnect()
	}

	qrChan, err := s.client.GetQRChannel(context.Background())
	if err != nil {
		s.mu.Lock()
		s.lastError = "Gagal membuat QR channel: " + err.Error()
		s.mu.Unlock()
		return err
	}

	err = s.client.Connect()
	if err != nil {
		s.mu.Lock()
		s.lastError = "Gagal menghubungkan client: " + err.Error()
		s.mu.Unlock()
		return err
	}

	for evt := range qrChan {
		if evt.Event == "code" {
			pngBytes, err := qrcode.Encode(evt.Code, qrcode.Medium, 256)
			var base64Img string
			if err == nil {
				base64Img = "data:image/png;base64," + base64.StdEncoding.EncodeToString(pngBytes)
			}

			s.mu.Lock()
			s.qrCode = evt.Code
			s.qrImage = base64Img
			s.lastError = ""
			s.mu.Unlock()
		} else if evt.Event == "success" {
			s.mu.Lock()
			s.qrCode = ""
			s.qrImage = ""
			s.lastError = ""
			s.lastConnected = time.Now().Format(time.RFC3339)
			s.mu.Unlock()
			break
		} else if evt.Event == "timeout" {
			s.mu.Lock()
			s.qrCode = ""
			s.qrImage = ""
			s.lastError = "QR code telah kedaluwarsa. Silakan refresh."
			s.mu.Unlock()
			break
		}
	}

	return nil
}

func (s *Service) Logout() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.client == nil {
		return nil
	}

	if s.client.IsLoggedIn() {
		_ = s.client.Logout(context.Background())
	} else if s.client.IsConnected() {
		s.client.Disconnect()
	}

	s.qrCode = ""
	s.qrImage = ""
	s.lastConnected = ""

	return nil
}

func (s *Service) GetStatus() StatusResponse {
	s.mu.RLock()
	defer s.mu.RUnlock()

	isConnected := false
	isLoggedIn := false
	phoneNumber := ""

	if s.client != nil {
		isConnected = s.client.IsConnected()
		isLoggedIn = s.client.IsLoggedIn()
		if s.client.Store.ID != nil {
			phoneNumber = s.client.Store.ID.User
		}
	}

	return StatusResponse{
		IsConnected:   isConnected,
		IsLoggedIn:    isLoggedIn,
		PhoneNumber:   phoneNumber,
		QRCode:        s.qrCode,
		QRCodeImage:   s.qrImage,
		LastError:     s.lastError,
		LastConnected: s.lastConnected,
	}
}

func (s *Service) SendMessage(phone string, text string) error {
	normalized, err := utils.NormalizePhoneNumber(phone)
	if err != nil {
		return err
	}

	s.mu.RLock()
	client := s.client
	s.mu.RUnlock()

	if client == nil || !client.IsLoggedIn() {
		return errors.New("bot WhatsApp belum terhubung / belum login")
	}

	jid := types.NewJID(normalized, types.DefaultUserServer)
	msg := &waProto.Message{
		Conversation: proto.String(strings.TrimSpace(text)),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	_, err = client.SendMessage(ctx, jid, msg)
	return err
}

func (s *Service) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.client != nil && s.client.IsConnected() {
		s.client.Disconnect()
	}
}

// Handler provides admin HTTP handlers for WhatsApp connection
type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) GetStatus(c *fiber.Ctx) error {
	status := h.svc.GetStatus()
	return c.JSON(fiber.Map{
		"success": true,
		"data":    status,
	})
}

func (h *Handler) Pair(c *fiber.Ctx) error {
	go func() {
		_ = h.svc.Pair()
	}()

	// Wait briefly for first QR code emission
	time.Sleep(1200 * time.Millisecond)

	status := h.svc.GetStatus()
	return c.JSON(fiber.Map{
		"success": true,
		"data":    status,
		"message": "Proses pairing dimulai. Silakan pindai kode QR yang muncul.",
	})
}

func (h *Handler) Logout(c *fiber.Ctx) error {
	if err := h.svc.Logout(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{"code": "SERVER_ERROR", "message": "Gagal logout WhatsApp: " + err.Error()},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Sesi WhatsApp berhasil diputus",
	})
}
