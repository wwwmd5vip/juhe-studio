package dto

type SubmitFeedbackInput struct {
	Type       string `json:"type" binding:"required,oneof=bug feature other"`
	Title      string `json:"title" binding:"required,max=200"`
	Content    string `json:"content" binding:"required,max=5000"`
	Contact    string `json:"contact" binding:"max=200"`
	AppVersion string `json:"app_version" binding:"max=50"`
	OS         string `json:"os" binding:"max=50"`
}
