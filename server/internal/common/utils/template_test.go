package utils

import "testing"

func TestRenderTemplate(t *testing.T) {
	tests := []struct {
		name      string
		template  string
		variables map[string]string
		required  map[string]bool
		want      string
		wantErr   bool
	}{
		{"simple", "A {{product}} on white", map[string]string{"product": "watch"}, nil, "A watch on white", false},
		{"required provided", "A {{product}} on white", map[string]string{"product": "watch"}, map[string]bool{"product": true}, "A watch on white", false},
		{"whitespace", "A {{ product }} on white", map[string]string{"product": "watch"}, nil, "A watch on white", false},
		{"multiple", "{{a}} and {{b}}", map[string]string{"a": "x", "b": "y"}, nil, "x and y", false},
		{"missing required", "A {{product}}", map[string]string{}, map[string]bool{"product": true}, "", true},
		{"empty value", "A {{product}}", map[string]string{"product": ""}, map[string]bool{"product": true}, "A ", false},
		{"unclosed", "A {{product", map[string]string{"product": "watch"}, map[string]bool{"product": true}, "", true},
		{"ignore extra", "A {{product}}", map[string]string{"product": "watch", "style": "x"}, map[string]bool{"product": true}, "A watch", false},
		{"unmatched braces", "A }}product{{", map[string]string{"product": "watch"}, map[string]bool{"product": true}, "", true},
		{"preserve undeclared", "A {{product}} and {{style}}", map[string]string{"product": "watch"}, map[string]bool{"product": true}, "A watch and {{style}}", false},
		{"no required preserves all", "A {{product}}", map[string]string{}, nil, "A {{product}}", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := RenderTemplate(tt.template, tt.variables, tt.required)
			if (err != nil) != tt.wantErr {
				t.Fatalf("RenderTemplate() error = %v, wantErr %v", err, tt.wantErr)
			}
			if got != tt.want {
				t.Fatalf("RenderTemplate() = %q, want %q", got, tt.want)
			}
		})
	}
}
