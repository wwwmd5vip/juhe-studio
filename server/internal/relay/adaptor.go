package relay

import (
	"context"
	"io"
	"net/http"

	"github.com/juhe-management/server/internal/dto"
)

type Adaptor interface {
	GetRequestURL(channel *ChannelContext, path string) string
	SetupRequestHeader(req *http.Request, channel *ChannelContext, info *RelayInfo) error
	ConvertRequest(ctx context.Context, info *RelayInfo, body []byte) ([]byte, error)
	DoRequest(ctx context.Context, req *http.Request) (*http.Response, error)
	ParseResponse(ctx context.Context, info *RelayInfo, resp *http.Response) (*RelayResponse, error)
}

type ChannelContext struct {
	Channel   *ChannelInfo
	Key       string
	BaseURL   string
	ModelMap  map[string]string
	ModelName string
}

type ChannelInfo struct {
	ID         uint64
	Type       string
	Name       string
	BaseURL    string
	Key        string
	ModelMap   map[string]string
	TimeoutSec int
}

type RelayResponse struct {
	StatusCode       int
	ContentType      string
	Body             io.ReadCloser
	Usage            dto.ChatCompletionUsage
	UpstreamModel    string
	Streaming        bool
	TransformStream  bool
	StreamHandler    func(w http.ResponseWriter, r *http.Request) (*dto.ChatCompletionUsage, error)
}
