package admin

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/domain"
)

func TestPromptHandler_parseID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewPromptHandler(nil, nil)

	tests := []struct {
		name    string
		param   string
		wantID  uint64
		wantErr bool
	}{
		{"valid id", "42", 42, false},
		{"invalid id", "abc", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Params = gin.Params{{Key: "id", Value: tt.param}}

			got, err := h.parseID(c)
			if (err != nil) != tt.wantErr {
				t.Fatalf("parseID() error = %v, wantErr %v", err, tt.wantErr)
			}
			if got != tt.wantID {
				t.Fatalf("parseID() = %d, want %d", got, tt.wantID)
			}
		})
	}
}

func TestPromptHandler_parsePromptType(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewPromptHandler(nil, nil)

	tests := []struct {
		name     string
		query    string
		wantType string
		wantErr  bool
	}{
		{"default image", "", domain.PromptTypeImage, false},
		{"explicit image", "type=image", domain.PromptTypeImage, false},
		{"agent", "type=agent", domain.PromptTypeAgent, false},
		{"package", "type=package", domain.PromptTypePackage, false},
		{"invalid video", "type=video", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/?"+tt.query, nil)

			got, err := h.parsePromptType(c)
			if (err != nil) != tt.wantErr {
				t.Fatalf("parsePromptType() error = %v, wantErr %v", err, tt.wantErr)
			}
			if got != tt.wantType {
				t.Fatalf("parsePromptType() = %q, want %q", got, tt.wantType)
			}
		})
	}
}
