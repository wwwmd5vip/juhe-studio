package relay

import (
	"github.com/juhe-management/server/internal/domain"
)

type RelayInfo struct {
	UserID    uint64
	TokenID   *uint64
	ChannelID uint64
	ModelName string
	// UpstreamModelName is the model name to send to the upstream provider.
	// Populated from the Model table's upstream_name field if set.
	UpstreamModelName string
	Group     string
	Channel   *domain.Channel
	Token     *domain.Token
	RequestID string
	Mode      domain.LogMode
	// ContentType overrides the default "application/json" when set (used for multipart endpoints).
	ContentType string
	IPAddress   string
	UserAgent   string
}
