package dto

type UpdatePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

type VerifyPasswordRequest struct {
	Password string `json:"password" binding:"required"`
}
