// JWT utility functions for token generation and validation.
//
// Known limitations for production:
//   - No token refresh mechanism — tokens are valid until expiry (default 24h).
//     Consider implementing refresh tokens for long-lived sessions.
//   - No token revocation/blacklist — compromised tokens remain valid until expiry.
//     Consider adding a token blacklist or using shorter TTLs for sensitive operations.
//   - HMAC-SHA256 used for signing. For multi-service deployments, consider RSA/ECDSA.
package utils

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type JWTClaims struct {
	UserID uint64 `json:"user_id"`
	Role   int    `json:"role"`
	jwt.RegisteredClaims
}

func GenerateJWT(secret string, userID uint64, role int, ttl time.Duration) (string, error) {
	claims := JWTClaims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(ttl)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ParseJWT(secret string, tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		return claims, nil
	}
	return nil, fmt.Errorf("invalid token claims")
}
