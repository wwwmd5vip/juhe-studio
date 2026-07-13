package utils

import "strings"

// EstimateTokenCount provides a rough token count for billing estimation.
// It uses the rule of thumb: 1 token ≈ 4 English characters or 0.5 Chinese characters.
func EstimateTokenCount(text string) int {
	if text == "" {
		return 0
	}
	chineseCount := 0
	charCount := 0
	for _, r := range text {
		charCount++
		if r > 127 {
			chineseCount++
		}
	}
	nonChinese := charCount - chineseCount
	// Chinese chars count as ~2 tokens per char (rough)
	// Non-Chinese characters count as ~0.25 tokens per char
	est := int(float64(nonChinese)*0.25 + float64(chineseCount)*0.5)
	if est < 1 {
		est = 1
	}
	return est
}

func EstimateMessagesTokens(messages []struct{ Role, Content string }) int {
	total := 0
	for _, m := range messages {
		total += EstimateTokenCount(m.Role)
		total += EstimateTokenCount(m.Content)
	}
	// overhead per message
	total += len(messages) * 4
	return total
}

func JoinMessages(messages []struct{ Role, Content string }) string {
	var sb strings.Builder
	for _, m := range messages {
		sb.WriteString(m.Role)
		sb.WriteString(": ")
		sb.WriteString(m.Content)
		sb.WriteString("\n")
	}
	return sb.String()
}
