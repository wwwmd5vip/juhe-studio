package config

import (
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port              string
	Env               string
	Database          DatabaseConfig
	JWT               JWTConfig
	BcryptCost        int
	LogLevel          string
	WebhookSecret     string
	LogRetentionDays  int
	MinPasswordLength int
	Scheduler         SchedulerConfig
	HealthCheck       HealthCheckConfig
	ChannelRetry      ChannelRetryConfig
	MaxRequestBodyBytes int64
	HTTPServer          HTTPServerConfig
	DBPool              DBPoolConfig
	CORSAllowedOrigins  string
	SMTPHost            string
	SMTPPort            string
	SMTPUsername        string
	SMTPPassword        string
	SMTPFrom            string
}

type SchedulerConfig struct {
	Enabled  bool
	Schedule string
}

type HealthCheckConfig struct {
	Enabled     bool
	Interval    string
	Timeout     int
	Threshold   int
	Concurrency int
}

type ChannelRetryConfig struct {
	MaxAttempts int
}

type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	Name     string
	Charset  string
}

type HTTPServerConfig struct {
	ReadTimeout       int
	WriteTimeout      int
	IdleTimeout       int
	ReadHeaderTimeout int
}

type DBPoolConfig struct {
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime int // seconds
	ConnMaxIdleTime int // seconds
}

type JWTConfig struct {
	Secret string
}

// parseIntEnv reads an env var as int with a default, logging a warning on parse failure.
func parseIntEnv(key, defaultVal string) int {
	raw := getEnv(key, defaultVal)
	v, err := strconv.Atoi(raw)
	if err != nil {
		log.Printf("WARNING: failed to parse %s=%q as int, using default %s: %v", key, raw, defaultVal, err)
		return parseIntDefault(defaultVal)
	}
	return v
}

// parseIntDefault parses the default string value — must be a valid integer.
func parseIntDefault(s string) int {
	v, _ := strconv.Atoi(s)
	return v
}

// parseLongEnv reads an env var as int64 with a default, logging a warning on parse failure.
func parseLongEnv(key, defaultVal string) int64 {
	raw := getEnv(key, defaultVal)
	v, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		log.Printf("WARNING: failed to parse %s=%q as int64, using default %s: %v", key, raw, defaultVal, err)
		v, _ = strconv.ParseInt(defaultVal, 10, 64)
	}
	return v
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Printf("WARNING: failed to load .env file: %v (using environment variables)", err)
	}

	cfg := &Config{
		Port:     getEnv("PORT", "7075"),
		Env:      strings.ToLower(getEnv("ENV", "development")),
		LogLevel: getEnv("LOG_LEVEL", "info"),
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "127.0.0.1"),
			Port:     parseIntEnv("DB_PORT", "3306"),
			User:     getEnv("DB_USER", "juhe"),
			Password: os.Getenv("DB_PASSWORD"),
			Name:     getEnv("DB_NAME", "juhe_management"),
			Charset:  getEnv("DB_CHARSET", "utf8mb4"),
		},
		JWT: JWTConfig{
			Secret: os.Getenv("JWT_SECRET"),
		},
		Scheduler: SchedulerConfig{
			Enabled:  getEnv("SCHEDULER_ENABLED", "true") != "false",
			Schedule: getEnv("SCHEDULER_SCHEDULE", "0 2 * * *"),
		},
		BcryptCost:          parseIntEnv("BCRYPT_COST", "10"),
		WebhookSecret:       os.Getenv("WEBHOOK_SECRET"),
		LogRetentionDays:    parseIntEnv("LOG_RETENTION_DAYS", "90"),
		MinPasswordLength:   parseIntEnv("MIN_PASSWORD_LENGTH", "8"),
		HealthCheck: HealthCheckConfig{
			Enabled:     getEnv("HEALTH_CHECK_ENABLED", "true") != "false",
			Interval:    getEnv("HEALTH_CHECK_INTERVAL", "*/5 * * * *"),
			Timeout:     parseIntEnv("HEALTH_CHECK_TIMEOUT", "10"),
			Threshold:   parseIntEnv("HEALTH_CHECK_THRESHOLD", "3"),
			Concurrency: parseIntEnv("HEALTH_CHECK_CONCURRENCY", "10"),
		},
		ChannelRetry: ChannelRetryConfig{
			MaxAttempts: parseIntEnv("CHANNEL_RETRY_MAX", "2"),
		},
		MaxRequestBodyBytes: parseLongEnv("MAX_REQUEST_BODY_BYTES", "10485760"),
		HTTPServer: HTTPServerConfig{
			ReadTimeout:       parseIntEnv("HTTP_READ_TIMEOUT", "30"),
			WriteTimeout:      parseIntEnv("HTTP_WRITE_TIMEOUT", "600"),
			IdleTimeout:       parseIntEnv("HTTP_IDLE_TIMEOUT", "120"),
			ReadHeaderTimeout: parseIntEnv("HTTP_READ_HEADER_TIMEOUT", "10"),
		},
		DBPool: DBPoolConfig{
			MaxOpenConns:    parseIntEnv("DB_MAX_OPEN_CONNS", "25"),
			MaxIdleConns:    parseIntEnv("DB_MAX_IDLE_CONNS", "10"),
			ConnMaxLifetime: parseIntEnv("DB_CONN_MAX_LIFETIME", "300"),
			ConnMaxIdleTime: parseIntEnv("DB_CONN_MAX_IDLE_TIME", "60"),
		},
		CORSAllowedOrigins: getEnv("CORS_ALLOWED_ORIGINS", "*"),
		SMTPHost:            os.Getenv("SMTP_HOST"),
		SMTPPort:            os.Getenv("SMTP_PORT"),
		SMTPUsername:        os.Getenv("SMTP_USERNAME"),
		SMTPPassword:        os.Getenv("SMTP_PASSWORD"),
		SMTPFrom:            os.Getenv("SMTP_FROM"),
	}

	// Security: CORS wildcard in production allows any origin with credentials
	if cfg.CORSAllowedOrigins == "*" {
		if strings.ToLower(cfg.Env) == "production" {
			log.Fatalf("CORS_ALLOWED_ORIGINS cannot be '*' in production. Set explicit origins.")
		}
		log.Printf("WARNING: CORS_ALLOWED_ORIGINS is set to wildcard '*' — acceptable for development only")
	}

	// Security: JWT secret must be set in production
	if cfg.Env == "production" && cfg.JWT.Secret == "" {
		log.Fatalf("JWT_SECRET is required in production mode")
	}
	if cfg.JWT.Secret == "" {
		log.Printf("WARNING: JWT_SECRET not set, using empty secret (INSECURE for production!)")
	}
	if len(cfg.JWT.Secret) > 0 && len(cfg.JWT.Secret) < 32 {
		log.Printf("WARNING: JWT_SECRET is shorter than 32 characters, consider using a stronger key")
	}

	// Webhook secret must be set in production
	if cfg.Env == "production" && cfg.WebhookSecret == "" {
		log.Printf("WARNING: WEBHOOK_SECRET is not set in production mode, webhooks may not work")
	}

	// ROOT_PASSWORD should differ from default in production
	rootPwd := os.Getenv("ROOT_PASSWORD")
	if cfg.Env == "production" && (rootPwd == "" || rootPwd == "juhe123456") {
		log.Printf("WARNING: ROOT_PASSWORD is using default or empty value, please set a strong password for production")
	}

	return cfg
}



func getEnv(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}
