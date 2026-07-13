package admin

import (
	"encoding/csv"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/middleware"
	"github.com/juhe-management/server/internal/service"
)

const (
	maxImportRows      = 1000
	maxCSVFileSize     = 1 << 20     // 1 MB max file size
	maxCSVFieldPerLine = 100          // max fields per CSV line
)

type ImportHandler struct {
	userService    *service.UserService
	tokenService   *service.TokenService
	channelService *service.ChannelService
}

func NewImportHandler(userSvc *service.UserService, tokenSvc *service.TokenService, channelSvc *service.ChannelService) *ImportHandler {
	return &ImportHandler{
		userService:    userSvc,
		tokenService:   tokenSvc,
		channelService: channelSvc,
	}
}

type importError struct {
	Row     int    `json:"row"`
	Message string `json:"message"`
}

type importResult struct {
	SuccessCount int           `json:"success_count"`
	FailCount    int           `json:"fail_count"`
	Errors       []importError `json:"errors"`
}

// parseCSVFile reads the multipart file and returns parsed CSV rows.
// Limits: maxCSVFileSize total, maxCSVFieldPerLine fields per row.
func parseCSVFile(c *gin.Context) ([][]string, error) {
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		return nil, err
	}
	defer file.Close()

	limitedReader := io.LimitReader(file, maxCSVFileSize)
	reader := csv.NewReader(limitedReader)
	reader.LazyQuotes = true
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = maxCSVFieldPerLine

	var rows [][]string
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		rows = append(rows, record)
	}
	return rows, nil
}

// ImportUsers handles POST /api/import/users
// CSV columns: username, password, role, quota
func (h *ImportHandler) ImportUsers(c *gin.Context) {
	rows, err := parseCSVFile(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "无法解析 CSV 文件: " + err.Error()})
		return
	}

	if len(rows) < 2 {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "CSV 文件至少需要包含表头和一行数据"})
		return
	}

	if len(rows) > maxImportRows+1 {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "CSV 行数超过上限（1000 行）"})
		return
	}

	// Skip header row
	result := importResult{}
	for i := 1; i < len(rows); i++ {
		row := rows[i]
		rowNum := i + 1 // 1-based row number in file

		if len(row) < 2 {
			result.FailCount++
			result.Errors = append(result.Errors, importError{Row: rowNum, Message: "缺少必填字段：username, password"})
			continue
		}

		username := strings.TrimSpace(row[0])
		password := strings.TrimSpace(row[1])

		if username == "" || password == "" {
			result.FailCount++
			result.Errors = append(result.Errors, importError{Row: rowNum, Message: "username 和 password 不能为空"})
			continue
		}

		role := 1
		if len(row) >= 3 && strings.TrimSpace(row[2]) != "" {
			r, err := strconv.Atoi(strings.TrimSpace(row[2]))
			if err != nil || (r != 1 && r != 10 && r != 100) {
				result.FailCount++
				result.Errors = append(result.Errors, importError{Row: rowNum, Message: "role 必须是 1, 10 或 100"})
				continue
			}
			role = r
		}

		quota := int64(0)
		if len(row) >= 4 && strings.TrimSpace(row[3]) != "" {
			q, err := strconv.ParseInt(strings.TrimSpace(row[3]), 10, 64)
			if err != nil {
				result.FailCount++
				result.Errors = append(result.Errors, importError{Row: rowNum, Message: "quota 必须是整数"})
				continue
			}
			quota = q
		}

		req := &dto.CreateUserRequest{
			Username: username,
			Password: password,
			Role:     role,
		}

		user, err := h.userService.CreateUser(c.Request.Context(), req, middleware.CurrentRole(c))
		if err != nil {
			result.FailCount++
			result.Errors = append(result.Errors, importError{Row: rowNum, Message: err.Error()})
			continue
		}

		if quota > 0 {
			if _, err := h.userService.AdjustQuota(c.Request.Context(), user.ID, quota, "CSV 批量导入初始额度"); err != nil {
				// User created successfully but quota adjustment failed — count as success
				// but log the warning so operator can manually fix.
				result.SuccessCount++
				result.Errors = append(result.Errors, importError{Row: rowNum, Message: "用户已创建但额度调整失败（需手动处理）: " + err.Error()})
			} else {
				result.SuccessCount++
			}
		} else {
			result.SuccessCount++
		}
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: result})
}

// ImportTokens handles POST /api/import/tokens
// CSV columns: name, user_id, remain_quota, group, model_limits
func (h *ImportHandler) ImportTokens(c *gin.Context) {
	rows, err := parseCSVFile(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "无法解析 CSV 文件: " + err.Error()})
		return
	}

	if len(rows) < 2 {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "CSV 文件至少需要包含表头和一行数据"})
		return
	}

	if len(rows) > maxImportRows+1 {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "CSV 行数超过上限（1000 行）"})
		return
	}

	result := importResult{}
	for i := 1; i < len(rows); i++ {
		row := rows[i]
		rowNum := i + 1

		if len(row) < 2 {
			result.FailCount++
			result.Errors = append(result.Errors, importError{Row: rowNum, Message: "缺少必填字段：name, user_id"})
			continue
		}

		name := strings.TrimSpace(row[0])
		userIDStr := strings.TrimSpace(row[1])

		if name == "" || userIDStr == "" {
			result.FailCount++
			result.Errors = append(result.Errors, importError{Row: rowNum, Message: "name 和 user_id 不能为空"})
			continue
		}

		userID, err := strconv.ParseUint(userIDStr, 10, 64)
		if err != nil {
			result.FailCount++
			result.Errors = append(result.Errors, importError{Row: rowNum, Message: "user_id 必须是整数"})
			continue
		}

		remainQuota := int64(0)
		if len(row) >= 3 && strings.TrimSpace(row[2]) != "" {
			q, err := strconv.ParseInt(strings.TrimSpace(row[2]), 10, 64)
			if err != nil {
				result.FailCount++
				result.Errors = append(result.Errors, importError{Row: rowNum, Message: "remain_quota 必须是整数"})
				continue
			}
			remainQuota = q
		}

		group := "default"
		if len(row) >= 4 && strings.TrimSpace(row[3]) != "" {
			group = strings.TrimSpace(row[3])
		}

		modelLimits := []string{}
		if len(row) >= 5 && strings.TrimSpace(row[4]) != "" {
			parts := strings.Split(strings.TrimSpace(row[4]), ",")
			for _, p := range parts {
				if t := strings.TrimSpace(p); t != "" {
					modelLimits = append(modelLimits, t)
				}
			}
		}

		req := &dto.CreateTokenRequest{
			Name:           name,
			RemainQuota:    remainQuota,
			UnlimitedQuota: false,
			Group:          group,
			ModelLimits:    modelLimits,
		}

		_, _, err = h.tokenService.CreateToken(c.Request.Context(), userID, req)
		if err != nil {
			result.FailCount++
			result.Errors = append(result.Errors, importError{Row: rowNum, Message: err.Error()})
			continue
		}

		result.SuccessCount++
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: result})
}

// ImportChannels handles POST /api/import/channels
// CSV columns: type, name, base_url, keys, models, groups, weight, priority
func (h *ImportHandler) ImportChannels(c *gin.Context) {
	rows, err := parseCSVFile(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "无法解析 CSV 文件: " + err.Error()})
		return
	}

	if len(rows) < 2 {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "CSV 文件至少需要包含表头和一行数据"})
		return
	}

	if len(rows) > maxImportRows+1 {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "CSV 行数超过上限（1000 行）"})
		return
	}

	result := importResult{}
	for i := 1; i < len(rows); i++ {
		row := rows[i]
		rowNum := i + 1

		if len(row) < 5 {
			result.FailCount++
			result.Errors = append(result.Errors, importError{Row: rowNum, Message: "缺少必填字段：type, name, base_url, keys, models"})
			continue
		}

		chType := strings.TrimSpace(row[0])
		name := strings.TrimSpace(row[1])
		baseURL := strings.TrimSpace(row[2])
		keys := strings.TrimSpace(row[3])
		models := strings.TrimSpace(row[4])

		if chType == "" || name == "" || models == "" {
			result.FailCount++
			result.Errors = append(result.Errors, importError{Row: rowNum, Message: "type, name, models 不能为空"})
			continue
		}

		// Validate channel type
		if !isKnownChannelType(chType) {
			result.FailCount++
			result.Errors = append(result.Errors, importError{Row: rowNum, Message: "不支持的渠道类型: " + chType})
			continue
		}

		groups := "default"
		if len(row) >= 6 && strings.TrimSpace(row[5]) != "" {
			groups = strings.TrimSpace(row[5])
		}

		weight := 1
		if len(row) >= 7 && strings.TrimSpace(row[6]) != "" {
			w, err := strconv.Atoi(strings.TrimSpace(row[6]))
			if err != nil {
				result.FailCount++
				result.Errors = append(result.Errors, importError{Row: rowNum, Message: "weight 必须是整数"})
				continue
			}
			weight = w
		}

		priority := 0
		if len(row) >= 8 && strings.TrimSpace(row[7]) != "" {
			p, err := strconv.Atoi(strings.TrimSpace(row[7]))
			if err != nil {
				result.FailCount++
				result.Errors = append(result.Errors, importError{Row: rowNum, Message: "priority 必须是整数"})
				continue
			}
			priority = p
		}

		req := &dto.CreateChannelRequest{
			Type:     chType,
			Name:     name,
			BaseURL:  baseURL,
			Keys:     keys,
			Models:   models,
			Groups:   groups,
			Weight:   weight,
			Priority: priority,
		}

		_, err := h.channelService.CreateChannel(c.Request.Context(), req)
		if err != nil {
			result.FailCount++
			result.Errors = append(result.Errors, importError{Row: rowNum, Message: err.Error()})
			continue
		}

		result.SuccessCount++
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: result})
}

func isKnownChannelType(t string) bool {
	for _, ct := range domain.ValidChannelTypes {
		if string(ct) == t {
			return true
		}
	}
	return false
}
