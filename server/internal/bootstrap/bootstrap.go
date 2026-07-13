package bootstrap

import (
	"fmt"
	"log"
	"net/url"
	"time"

	"github.com/juhe-management/server/internal/config"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func NewDB(cfg *config.Config) *gorm.DB {
	// url.UserPassword correctly encodes special characters in the password
	// (unlike url.QueryEscape which would encode @ as %40 and break the DSN)
	userInfo := url.UserPassword(cfg.Database.User, cfg.Database.Password).String()
	dsn := fmt.Sprintf(
		"%s@tcp(%s:%d)/%s?charset=%s&parseTime=True&loc=Local",
		userInfo,
		cfg.Database.Host,
		cfg.Database.Port,
		cfg.Database.Name,
		cfg.Database.Charset,
	)

	level := logger.Warn
	if cfg.Env == "development" {
		level = logger.Info
	}

	var db *gorm.DB
	var err error
	for i := 0; i < 5; i++ {
		db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
			Logger: logger.Default.LogMode(level),
		})
		if err == nil {
			log.Printf("database connected successfully (attempt %d)", i+1)
			break
		}
		log.Printf("failed to connect to database (attempt %d/5): %v", i+1, err)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		log.Fatalf("failed to connect database after 5 attempts: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("failed to get underlying sql.DB: %v", err)
	}

	sqlDB.SetMaxOpenConns(cfg.DBPool.MaxOpenConns)
	sqlDB.SetMaxIdleConns(cfg.DBPool.MaxIdleConns)
	sqlDB.SetConnMaxLifetime(time.Duration(cfg.DBPool.ConnMaxLifetime) * time.Second)
	sqlDB.SetConnMaxIdleTime(time.Duration(cfg.DBPool.ConnMaxIdleTime) * time.Second)

	return db
}
