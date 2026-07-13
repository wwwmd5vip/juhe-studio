package channel

import (
	"net"
	"net/http"
	"sync"
	"time"
)

// MaxUpstreamResponseSize is the maximum upstream response body size (32 MB).
// Responses exceeding this limit are truncated to prevent OOM from malicious/misconfigured upstreams.
const MaxUpstreamResponseSize = 32 << 20 // 32 MB

// sharedTransport is a package-level HTTP transport reused across all adaptor
// instances so that connection pooling (keep-alive, idle conns) works even
// though each request gets a fresh adaptor struct.
var (
	sharedTransport     *http.Transport
	sharedTransportOnce sync.Once
)

func getSharedTransport() *http.Transport {
	sharedTransportOnce.Do(func() {
		sharedTransport = &http.Transport{
			DialContext: (&net.Dialer{
				Timeout:   10 * time.Second,
				KeepAlive: 30 * time.Second,
			}).DialContext,
			MaxIdleConns:          100,
			MaxIdleConnsPerHost:   10,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   10 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
		}
	})
	return sharedTransport
}

// BaseAdaptor 提供共享的 HTTP 客户端（连接池复用）、超时控制和基础能力
type BaseAdaptor struct {
	client *http.Client
}

// NewBaseAdaptor 创建带连接池和超时控制的 HTTP 客户端。
// 连接池（Transport）在所有 adaptor 实例间共享，每个实例只持有独立的
// *http.Client（超时不同），避免了缓存 adaptor 实例导致的并发字段竞争。
func NewBaseAdaptor(timeoutSec int) BaseAdaptor {
	if timeoutSec <= 0 {
		timeoutSec = 60
	}
	return BaseAdaptor{
		client: &http.Client{
			Timeout:   time.Duration(timeoutSec) * time.Second,
			Transport: getSharedTransport(),
		},
	}
}

// Client 返回底层 HTTP 客户端
func (b *BaseAdaptor) Client() *http.Client {
	return b.client
}
