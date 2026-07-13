package service

import (
	"errors"
	"testing"

	"github.com/juhe-management/server/internal/domain"
)

func TestPromptService_validatePromptType(t *testing.T) {
	svc := NewPromptService(nil, nil, nil, nil)

	tests := []struct {
		name       string
		promptType string
		wantErr    error
	}{
		{"image", domain.PromptTypeImage, nil},
		{"agent", domain.PromptTypeAgent, nil},
		{"package", domain.PromptTypePackage, nil},
		{"video", "video", ErrInvalidPromptType},
		{"empty", "", ErrInvalidPromptType},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := svc.validatePromptType(tt.promptType)
			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("validatePromptType(%q) error = %v, want %v", tt.promptType, err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("validatePromptType(%q) unexpected error: %v", tt.promptType, err)
			}
		})
	}
}
