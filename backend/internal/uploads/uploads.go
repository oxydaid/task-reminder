package uploads

import (
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type Handler struct {
	baseDir string
}

func NewHandler(baseDir string) *Handler {
	if baseDir == "" {
		baseDir = "./data/uploads"
	}
	_ = os.MkdirAll(filepath.Join(baseDir, "proofs"), 0755)
	_ = os.MkdirAll(filepath.Join(baseDir, "qris"), 0755)
	return &Handler{baseDir: baseDir}
}

// UploadProof handles payment proof uploads
func (h *Handler) UploadProof(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "NO_FILE", "message": "File bukti pembayaran wajib diunggah"},
		})
	}

	url, err := h.saveFile(file, "proofs")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "UPLOAD_FAILED", "message": err.Error()},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"url":       url,
			"file_name": file.Filename,
			"file_size": file.Size,
		},
		"message": "File berhasil diunggah",
	})
}

// UploadQRIS handles QRIS image uploads (Admin only)
func (h *Handler) UploadQRIS(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "NO_FILE", "message": "File gambar QRIS wajib diunggah"},
		})
	}

	url, err := h.saveFile(file, "qris")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "UPLOAD_FAILED", "message": err.Error()},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"url":       url,
			"file_name": file.Filename,
			"file_size": file.Size,
		},
		"message": "Gambar QRIS berhasil diunggah",
	})
}

func (h *Handler) saveFile(file *multipart.FileHeader, subDir string) (string, error) {
	// Max 5 MB
	if file.Size > 5*1024*1024 {
		return "", fmt.Errorf("ukuran file maksimal 5 MB")
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" {
		return "", fmt.Errorf("format file tidak didukung. Harap unggah gambar JPG, PNG, atau WEBP")
	}

	targetDir := filepath.Join(h.baseDir, subDir)
	_ = os.MkdirAll(targetDir, 0755)

	safeName := fmt.Sprintf("%d-%s%s", time.Now().Unix(), uuid.New().String()[:8], ext)
	targetPath := filepath.Join(targetDir, safeName)

	src, err := file.Open()
	if err != nil {
		return "", fmt.Errorf("gagal membuka file: %w", err)
	}
	defer src.Close()

	dst, err := os.Create(targetPath)
	if err != nil {
		return "", fmt.Errorf("gagal menyimpan file: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return "", fmt.Errorf("gagal menulis file: %w", err)
	}

	return fmt.Sprintf("/uploads/%s/%s", subDir, safeName), nil
}
