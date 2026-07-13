package email

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"net"
	"net/smtp"
	"strings"
	"time"
)

type Config struct {
	Host     string
	Port     string
	Username string
	Password string
	From     string
}

// ConfigProvider 提供动态 SMTP 配置（由 settingService 实现，避免循环依赖）。
// ctx 用于数据库查询的追踪和超时控制。
type ConfigProvider interface {
	SMTPConfig(ctx context.Context) Config
}

type Sender struct {
	provider ConfigProvider
}

// NewSender 创建邮件发送器。provider 用于每次发送前动态获取 SMTP 配置。
func NewSender(provider ConfigProvider) *Sender {
	return &Sender{provider: provider}
}

func (s *Sender) SendVerificationEmail(ctx context.Context, to, code string) error {
	cfg := s.provider.SMTPConfig(ctx)
	if cfg.Host == "" {
		return fmt.Errorf("smtp not configured")
	}
	subject := "Juhe Studio — 邮箱验证"
	body := fmt.Sprintf(`
			<h2>欢迎注册 Juhe Studio</h2>
			<p>您的验证码是: <strong>%s</strong></p>
			<p>验证链接: <a href="https://your-domain.com/verify?code=%s">点击验证</a></p>
			<p>该验证码 30 分钟内有效。</p>
		`, code, code)
	return s.send(cfg, to, subject, body)
}

// ErrSMTPNotConfigured is returned when SMTP host is empty.
var ErrSMTPNotConfigured = fmt.Errorf("smtp not configured")

// send retries SMTP delivery up to 3 times on temporary errors (DNS, connection
// refused, timeout). Permanent errors (auth failure, bad address) are not retried.
func (s *Sender) send(cfg Config, to, subject, body string) error {
	if cfg.Host == "" {
		return ErrSMTPNotConfigured
	}

	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt) * time.Second)
		}
		if err := s.sendOnce(cfg, to, subject, body); err != nil {
			if !isTemporary(err) {
				return err
			}
			lastErr = err
			continue
		}
		return nil
	}
	return fmt.Errorf("email send failed after 3 attempts: %w", lastErr)
}

// sendOnce performs a single SMTP delivery attempt.
func (s *Sender) sendOnce(cfg Config, to, subject, body string) error {
	auth := smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)
	msg := []byte(fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n%s",
		cfg.From, to, subject, body))

	// Dial with explicit timeout to avoid blocking the HTTP handler indefinitely
	// when the SMTP server is unreachable (smtp.SendMail default dial has no timeout).
	dialer := net.Dialer{Timeout: 10 * time.Second}
	conn, err := dialer.Dial("tcp", cfg.Host+":"+cfg.Port)
	if err != nil {
		return err
	}
	client, err := smtp.NewClient(conn, cfg.Host)
	if err != nil {
		conn.Close()
		return err
	}
	defer client.Close()

	if err = client.Auth(auth); err != nil {
		return err
	}
	if err = client.Mail(cfg.From); err != nil {
		return err
	}
	if err = client.Rcpt(to); err != nil {
		return err
	}
	w, err := client.Data()
	if err != nil {
		return err
	}
	_, err = w.Write(msg)
	if err != nil {
		return err
	}
	return w.Close()
}

// isTemporary reports whether err is a temporary network error (timeout,
// connection refused, DNS) that warrants a retry. Permanent errors such as
// auth failure or bad recipient are not retried.
func isTemporary(err error) bool {
	if netErr, ok := err.(net.Error); ok && (netErr.Timeout() || netErr.Temporary()) {
		return true
	}
	// On some platforms (e.g. macOS), connection refused does not implement
	// Temporary(). Detect it and other transient failures via the message.
	s := err.Error()
	if strings.Contains(s, "connection refused") || strings.Contains(s, "no such host") {
		return true
	}
	return false
}

// SendTestEmail 发送测试邮件
func (s *Sender) SendTestEmail(ctx context.Context, to string) error {
	cfg := s.provider.SMTPConfig(ctx)
	if cfg.Host == "" {
		return fmt.Errorf("smtp not configured")
	}
	subject := "Juhe Studio — 邮件服务测试"
	body := "<h2>邮件服务配置测试</h2><p>这封邮件来自 Juhe Studio 管理后台的邮件服务测试功能。</p><p>如果您收到此邮件，说明 SMTP 配置正确。</p>"
	return s.send(cfg, to, subject, body)
}

// StaticConfigProvider 固定配置提供者
type StaticConfigProvider struct {
	cfg Config
}

func NewStaticConfigProvider(cfg Config) *StaticConfigProvider {
	return &StaticConfigProvider{cfg: cfg}
}

func (p *StaticConfigProvider) SMTPConfig(_ context.Context) Config {
	return p.cfg
}

// GenerateCode generates an 8-digit verification code
func GenerateCode() string {
	b := make([]byte, 4)
	rand.Read(b)
	n := int64(binary.BigEndian.Uint32(b))
	if n < 0 {
		n = -n
	}
	return fmt.Sprintf("%08d", n%100000000)
}
