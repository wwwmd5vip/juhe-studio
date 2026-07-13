package utils

import (
	"fmt"
	"regexp"
	"strings"
)

var placeholderRe = regexp.MustCompile(`\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}`)

// RenderTemplate replaces Mustache-style {{name}} placeholders.
// If required is non-nil, any placeholder for a required variable that is missing from variables causes an error.
// Undeclared (non-required) placeholders are left unchanged.
// Unclosed {{ without a matching valid placeholder returns an error.
func RenderTemplate(template string, variables map[string]string, required map[string]bool) (string, error) {
	// Validate mustache closure on the original template before variable
	// replacement, so values containing {{ are not falsely flagged as unclosed.
	for i := strings.Index(template, "{{"); i != -1; {
		loc := placeholderRe.FindStringIndex(template[i:])
		if loc == nil || loc[0] != 0 {
			return "", fmt.Errorf("unclosed template placeholder")
		}
		next := i + loc[1]
		rest := strings.Index(template[next:], "{{")
		if rest == -1 {
			break
		}
		i = next + rest
	}

	var missing []string
	result := placeholderRe.ReplaceAllStringFunc(template, func(match string) string {
		parts := placeholderRe.FindStringSubmatch(match)
		name := parts[1]
		value, ok := variables[name]
		if !ok {
			if required != nil && required[name] {
				missing = append(missing, name)
			}
			return match
		}
		return value
	})
	if len(missing) > 0 {
		return "", fmt.Errorf("missing variables: %s", strings.Join(missing, ", "))
	}
	return result, nil
}
