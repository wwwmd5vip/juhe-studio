package service

import (
	"github.com/juhe-management/server/internal/common/utils"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
)

func ToUserInfo(user *domain.User) dto.UserInfo {
	return dto.UserInfo{
		ID:                   user.ID,
		Username:             user.Username,
		Email:                user.Email,
		Role:                 int(user.Role),
		Status:               int(user.Status),
		Group:                user.Group,
		Quota:                user.Quota,
		UsedQuota:            user.UsedQuota,
		PlaygroundTrialsUsed: user.PlaygroundTrialsUsed,
		CreatedAt:            user.CreatedAt,
		UpdatedAt:            user.UpdatedAt,
	}
}

func UserInfoList(users []domain.User) []dto.UserInfo {
	result := make([]dto.UserInfo, len(users))
	for i := range users {
		result[i] = ToUserInfo(&users[i])
	}
	return result
}

func ToChannelInfo(channel *domain.Channel) dto.ChannelInfo {
	info := dto.ChannelInfo{
		ID:             channel.ID,
		Type:           string(channel.Type),
		Name:           channel.Name,
		BaseURL:        channel.BaseURL,
		AuthType:       string(channel.AuthType),
		Keys:           channel.Keys,
		Models:         channel.Models,
		Groups:         channel.Groups,
		Weight:         channel.Weight,
		Priority:       channel.Priority,
		Status:         int(channel.Status),
		TimeoutSeconds: channel.TimeoutSeconds,
		AutoBan:        channel.AutoBan,
		FailCount:      channel.FailCount,
		LastError:      channel.LastError,
		CreatedAt:      channel.CreatedAt,
		UpdatedAt:      channel.UpdatedAt,
	}
	var modelMapping map[string]string
	utils.ParseJSONString(channel.ModelMapping, &modelMapping)
	info.ModelMapping = modelMapping

	var statusCodeMapping map[string]string
	utils.ParseJSONString(channel.StatusCodeMapping, &statusCodeMapping)
	info.StatusCodeMapping = statusCodeMapping

	return info
}

func ChannelInfoList(channels []domain.Channel) []dto.ChannelInfo {
	result := make([]dto.ChannelInfo, len(channels))
	for i := range channels {
		result[i] = ToChannelInfo(&channels[i])
	}
	return result
}

func ToModelInfo(model *domain.Model) dto.ModelInfo {
	info := dto.ModelInfo{
		ID:              model.ID,
		ModelName:       model.ModelName,
		DisplayName:     model.DisplayName,
		UpstreamName:    model.UpstreamName,
		Type:            string(model.Type),
		VendorID:        model.VendorID,
		MatchRule:       int(model.MatchRule),
		ContextWindow:   model.ContextWindow,
		MaxOutputTokens: model.MaxOutputTokens,
		Status:          model.Status,
		CreatedAt:       model.CreatedAt,
		UpdatedAt:       model.UpdatedAt,
	}
	info.Endpoints = endpointTypesToStrings(model.Endpoints)
	info.Capabilities = modelCapabilitiesToStrings(model.Capabilities)
	return info
}

func endpointTypesToStrings(types domain.EndpointTypes) []string {
	if len(types) == 0 {
		return nil
	}
	result := make([]string, len(types))
	for i, t := range types {
		result[i] = string(t)
	}
	return result
}

func modelCapabilitiesToStrings(caps domain.ModelCapabilities) []string {
	if len(caps) == 0 {
		return nil
	}
	result := make([]string, len(caps))
	for i, c := range caps {
		result[i] = string(c)
	}
	return result
}

func ModelInfoList(models []domain.Model) []dto.ModelInfo {
	result := make([]dto.ModelInfo, len(models))
	for i := range models {
		result[i] = ToModelInfo(&models[i])
	}
	return result
}

func ToPricingInfo(pricing *domain.Pricing) dto.PricingInfo {
	return dto.PricingInfo{
		ID:              pricing.ID,
		ModelName:       pricing.ModelName,
		Group:           pricing.Group,
		BillingMode:     string(pricing.BillingMode),
		ModelRatio:      pricing.ModelRatio,
		CompletionRatio: pricing.CompletionRatio,
		FixedPriceCents: pricing.FixedPriceCents,
		ImageRatio:      pricing.ImageRatio,
		TieredExpr:      pricing.TieredExpr,
		EffectiveFrom:   pricing.EffectiveFrom,
		CreatedAt:       pricing.CreatedAt,
		UpdatedAt:       pricing.UpdatedAt,
	}
}

func PricingInfoList(pricings []domain.Pricing) []dto.PricingInfo {
	result := make([]dto.PricingInfo, len(pricings))
	for i := range pricings {
		result[i] = ToPricingInfo(&pricings[i])
	}
	return result
}
func ToPromptInfo(p *domain.Prompt) dto.PromptInfo {
	info := dto.PromptInfo{
		ID:         p.ID,
		Type:       p.Type,
		CategoryID: p.CategoryID,
		Title:      p.Title,
		Content:    p.Content,
		Status:     int(p.Status),
		AuthorID:   p.AuthorID,
		CreatedAt:  p.CreatedAt,
		UpdatedAt:  p.UpdatedAt,
	}
	info.Variables = p.GetVariables()
	info.Tags = p.GetTags()
	return info
}

func ToPromptListItem(p *domain.Prompt) dto.PromptListItem {
	item := dto.PromptListItem{
		ID:         p.ID,
		Type:       p.Type,
		CategoryID: p.CategoryID,
		Title:      p.Title,
		Status:     int(p.Status),
		AuthorID:   p.AuthorID,
		CreatedAt:  p.CreatedAt,
		UpdatedAt:  p.UpdatedAt,
	}
	item.Variables = p.GetVariables()
	item.Tags = p.GetTags()
	return item
}

func PromptInfoList(prompts []domain.Prompt) []dto.PromptInfo {
	result := make([]dto.PromptInfo, len(prompts))
	for i := range prompts {
		result[i] = ToPromptInfo(&prompts[i])
	}
	return result
}

func PromptListItemList(prompts []domain.Prompt) []dto.PromptListItem {
	result := make([]dto.PromptListItem, len(prompts))
	for i := range prompts {
		result[i] = ToPromptListItem(&prompts[i])
	}
	return result
}

func ToCategoryInfo(c *domain.PromptCategory) dto.CategoryInfo {
	info := dto.CategoryInfo{
		ID:        c.ID,
		Name:      c.Name,
		Type:      c.Type,
		SortOrder: c.SortOrder,
		CreatedAt: c.CreatedAt,
		UpdatedAt: c.UpdatedAt,
	}
	if c.Description != nil && *c.Description != "" {
		info.Description = c.Description
	}
	return info
}

func CategoryInfoList(categories []domain.PromptCategory) []dto.CategoryInfo {
	result := make([]dto.CategoryInfo, len(categories))
	for i := range categories {
		result[i] = ToCategoryInfo(&categories[i])
	}
	return result
}

func ToTopUpInfo(t *domain.TopUp) dto.TopUpInfo {
	return dto.TopUpInfo{
		ID:            t.ID,
		UserID:        t.UserID,
		PackageID:     t.PackageID,
		AmountCents:   t.AmountCents,
		QuotaGranted:  t.QuotaGranted,
		Currency:      t.Currency,
		PaymentMethod: t.PaymentMethod,
		PaymentStatus: int(t.PaymentStatus),
		TransactionID: t.TransactionID,
		PaidAt:        t.PaidAt,
		CreatedAt:     t.CreatedAt,
		UpdatedAt:     t.UpdatedAt,
	}
}

func ToTopUpInfoList(list []domain.TopUp) []dto.TopUpInfo {
	result := make([]dto.TopUpInfo, len(list))
	for i := range list {
		result[i] = ToTopUpInfo(&list[i])
	}
	return result
}

func ToTokenInfo(token *domain.Token) dto.TokenInfo {
	info := dto.TokenInfo{
		ID:              token.ID,
		UserID:          token.UserID,
		Name:            token.Name,
		KeyMask:         token.KeyMask,
		Status:          int(token.Status),
		RemainQuota:     token.RemainQuota,
		UnlimitedQuota:  token.UnlimitedQuota,
		Group:           token.Group,
		AllowedIPs:      token.AllowedIPs,
		RateLimit:       token.RateLimit,
		CrossGroupRetry: token.CrossGroupRetry,
		LastUsedAt:      token.LastUsedAt,
		CreatedAt:       token.CreatedAt,
		UpdatedAt:       token.UpdatedAt,
	}
	utils.ParseJSONString(token.ModelLimits, &info.ModelLimits)
	return info
}

func TokenInfoList(tokens []domain.Token) []dto.TokenInfo {
	result := make([]dto.TokenInfo, len(tokens))
	for i := range tokens {
		result[i] = ToTokenInfo(&tokens[i])
	}
	return result
}

func ToRedemptionInfo(rd *domain.Redemption) dto.RedemptionInfo {
	return dto.RedemptionInfo{
		ID:         rd.ID,
		Code:       rd.Code,
		QuotaValue: rd.QuotaValue,
		Status:     int(rd.Status),
		UsedBy:     rd.UsedBy,
		UsedAt:     rd.UsedAt,
		ExpiresAt:  rd.ExpiresAt,
		CreatedAt:  rd.CreatedAt,
	}
}

func ToRedemptionInfoList(list []domain.Redemption) []dto.RedemptionInfo {
	result := make([]dto.RedemptionInfo, len(list))
	for i := range list {
		result[i] = ToRedemptionInfo(&list[i])
	}
	return result
}

func ToQuotaPackageInfo(p *domain.QuotaPackage) dto.QuotaPackageInfo {
	return dto.QuotaPackageInfo{
		ID:         p.ID,
		Name:       p.Name,
		QuotaValue: p.QuotaValue,
		PriceCents: p.PriceCents,
		Currency:   p.Currency,
		Status:     int(p.Status),
		SortOrder:  p.SortOrder,
		CreatedAt:  p.CreatedAt,
		UpdatedAt:  p.UpdatedAt,
	}
}

func ToQuotaPackageInfoList(list []domain.QuotaPackage) []dto.QuotaPackageInfo {
	result := make([]dto.QuotaPackageInfo, len(list))
	for i := range list {
		result[i] = ToQuotaPackageInfo(&list[i])
	}
	return result
}

func ToQuotaTransactionInfo(t *domain.QuotaTransaction) dto.QuotaTransactionInfo {
	return dto.QuotaTransactionInfo{
		ID:           t.ID,
		UserID:       t.UserID,
		TokenID:      t.TokenID,
		Type:         string(t.Type),
		Amount:       t.Amount,
		BalanceAfter: t.BalanceAfter,
		RelatedID:    t.RelatedID,
		RelatedType:  t.RelatedType,
		Description:  t.Description,
		CreatedAt:    t.CreatedAt,
	}
}

func ToQuotaTransactionInfoList(list []domain.QuotaTransaction) []dto.QuotaTransactionInfo {
	result := make([]dto.QuotaTransactionInfo, len(list))
	for i := range list {
		result[i] = ToQuotaTransactionInfo(&list[i])
	}
	return result
}

func ToDailyBillInfo(b *domain.DailyBill) dto.DailyBillInfo {
	return dto.DailyBillInfo{
		ID:             b.ID,
		BillDate:       b.BillDate,
		UserID:         b.UserID,
		ModelName:      b.ModelName,
		RequestCount:   b.RequestCount,
		TokenCount:     b.TokenCount,
		QuotaConsumed:  b.QuotaConsumed,
		QuotaRecharged: b.QuotaRecharged,
		CreatedAt:      b.CreatedAt,
		UpdatedAt:      b.UpdatedAt,
	}
}

func ToDailyBillInfoList(list []domain.DailyBill) []dto.DailyBillInfo {
	result := make([]dto.DailyBillInfo, len(list))
	for i := range list {
		result[i] = ToDailyBillInfo(&list[i])
	}
	return result
}

func ToSubscriptionPlanInfo(p *domain.SubscriptionPlan) dto.SubscriptionPlanInfo {
	return dto.SubscriptionPlanInfo{
		ID:             p.ID,
		Name:           p.Name,
		QuotaValue:     p.QuotaValue,
		PriceCents:     p.PriceCents,
		Currency:       p.Currency,
		IntervalMonths: p.IntervalMonths,
		Status:         int(p.Status),
		SortOrder:      p.SortOrder,
		CreatedAt:      p.CreatedAt,
		UpdatedAt:      p.UpdatedAt,
	}
}

func ToSubscriptionPlanInfoList(list []domain.SubscriptionPlan) []dto.SubscriptionPlanInfo {
	result := make([]dto.SubscriptionPlanInfo, len(list))
	for i := range list {
		result[i] = ToSubscriptionPlanInfo(&list[i])
	}
	return result
}

func ToUserSubscriptionInfo(s *domain.UserSubscription) dto.UserSubscriptionInfo {
	return dto.UserSubscriptionInfo{
		ID:           s.ID,
		UserID:       s.UserID,
		PlanID:       s.PlanID,
		Status:       int(s.Status),
		StartedAt:    s.StartedAt,
		ExpiresAt:    s.ExpiresAt,
		LastBilledAt: s.LastBilledAt,
		CreatedAt:    s.CreatedAt,
		UpdatedAt:    s.UpdatedAt,
	}
}

func ToUserSubscriptionInfoList(list []domain.UserSubscription) []dto.UserSubscriptionInfo {
	result := make([]dto.UserSubscriptionInfo, len(list))
	for i := range list {
		result[i] = ToUserSubscriptionInfo(&list[i])
	}
	return result
}

func ToPromptVersionInfo(v *domain.PromptVersion) dto.PromptVersionInfo {
	info := dto.PromptVersionInfo{
		ID:        v.ID,
		PromptID:  v.PromptID,
		Title:     v.Title,
		Content:   v.Content,
		AuthorID:  v.AuthorID,
		CreatedAt: v.CreatedAt,
	}
	info.Variables = make(map[string]string)
	utils.ParseJSONString(v.Variables, &info.Variables)
	utils.ParseJSONString(v.Tags, &info.Tags)
	return info
}

func PromptVersionInfoList(vs []domain.PromptVersion) []dto.PromptVersionInfo {
	result := make([]dto.PromptVersionInfo, len(vs))
	for i := range vs {
		result[i] = ToPromptVersionInfo(&vs[i])
	}
	return result
}

func ToPromptPackageItemInfo(item *domain.PromptPackageItem) dto.PromptPackageItemInfo {
	return dto.PromptPackageItemInfo{
		ID:        item.ID,
		PromptID:  item.PromptID,
		SortOrder: item.SortOrder,
	}
}

func PromptPackageItemInfoList(items []domain.PromptPackageItem) []dto.PromptPackageItemInfo {
	result := make([]dto.PromptPackageItemInfo, len(items))
	for i := range items {
		result[i] = ToPromptPackageItemInfo(&items[i])
	}
	return result
}
