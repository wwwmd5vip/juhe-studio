package utils

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
)

func GenerateAPIKey() (full string, hash string, mask string, err error) {
	const prefix = "sk-juhe"
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return "", "", "", err
	}
	random := hex.EncodeToString(b)
	full = fmt.Sprintf("%s-%s", prefix, random)

	h := sha256.Sum256([]byte(full))
	hash = hex.EncodeToString(h[:])

	mask = fmt.Sprintf("%s-...%s", prefix, random[len(random)-6:])
	return full, hash, mask, nil
}

func GenerateRequestID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("req-%d", time.Now().UnixNano())
	}
	return "req-" + hex.EncodeToString(b)
}

func HashAPIKey(key string) string {
	h := sha256.Sum256([]byte(key))
	return hex.EncodeToString(h[:])
}

func MaskAPIKey(key string) string {
	if len(key) <= 10 {
		return key
	}
	parts := strings.Split(key, "-")
	if len(parts) >= 2 {
		last := parts[len(parts)-1]
		if len(last) > 6 {
			return parts[0] + "-..." + last[len(last)-6:]
		}
	}
	return key[:6] + "..."
}
