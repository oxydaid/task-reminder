package utils

import (
	"errors"
	"regexp"
	"strings"
)

var (
	nonDigitRegex = regexp.MustCompile(`\D`)
)

// NormalizePhoneNumber normalizes Indonesian phone numbers to canonical format 62xxxxxxxxxx
func NormalizePhoneNumber(phone string) (string, error) {
	cleaned := strings.TrimSpace(phone)
	cleaned = nonDigitRegex.ReplaceAllString(cleaned, "")

	if cleaned == "" {
		return "", errors.New("nomor telepon tidak boleh kosong")
	}

	if strings.HasPrefix(cleaned, "0") {
		cleaned = "62" + cleaned[1:]
	} else if strings.HasPrefix(cleaned, "8") {
		cleaned = "62" + cleaned
	} else if strings.HasPrefix(cleaned, "62") {
		// already has 62 prefix
	} else {
		return "", errors.New("format nomor telepon tidak valid. Gunakan format Indonesia (contoh: 08123456789)")
	}

	if len(cleaned) < 10 || len(cleaned) > 16 {
		return "", errors.New("panjang nomor telepon tidak valid (10-16 digit)")
	}

	return cleaned, nil
}
