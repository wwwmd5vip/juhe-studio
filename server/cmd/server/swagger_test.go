package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "github.com/juhe-management/server/docs"
)

func TestSwaggerRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler,
		ginSwagger.URL("/api/swagger/doc.json"),
		ginSwagger.DefaultModelsExpandDepth(-1),
	))

	req := httptest.NewRequest(http.MethodGet, "/api/swagger/index.html", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("swagger index returned status %d: %s", w.Code, w.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, "/api/swagger/doc.json", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("swagger doc.json returned status %d: %s", w.Code, w.Body.String())
	}
	if w.Body.Len() == 0 {
		t.Fatal("swagger doc.json returned empty body")
	}
}
