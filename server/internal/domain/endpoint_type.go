package domain

// EndpointType 定义 API 端点类型（控制路由到哪个 Adaptor）
type EndpointType string

const (
	EndpointChatCompletions    EndpointType = "chat/completions"
	EndpointImagesGenerations  EndpointType = "images/generations"
	EndpointEmbeddings         EndpointType = "embeddings"
	EndpointAudioSpeech        EndpointType = "audio/speech"
	EndpointAudioTranscription EndpointType = "audio/transcriptions"
	EndpointRerank             EndpointType = "rerank"
	EndpointModerations        EndpointType = "moderations"
	EndpointResponses          EndpointType = "responses"
)

// ModelCapability 模型能力标签（用于前端过滤和展示）
type ModelCapability string

const (
	CapFunctionCall     ModelCapability = "function-call"
	CapVision           ModelCapability = "vision"
	CapImageGeneration  ModelCapability = "image-generation"
	CapImageInput	ModelCapability = "image-input"
	CapAudioInput       ModelCapability = "audio-input"
	CapAudioOutput      ModelCapability = "audio-output"
	CapEmbedding        ModelCapability = "embedding"
	CapRerank           ModelCapability = "rerank"
	CapReasoning        ModelCapability = "reasoning"
	CapWebSearch        ModelCapability = "web-search"
	CapVideoInput       ModelCapability = "video-input"
	CapVideoGeneration  ModelCapability = "video-generation"
	CapStructuredOutput ModelCapability = "structured-output"
)

// ValidModelCapabilities returns all valid model capability constants.
func ValidModelCapabilities() map[ModelCapability]bool {
	return map[ModelCapability]bool{
		CapFunctionCall: true, CapVision: true, CapImageGeneration: true,
		CapImageInput: true, CapAudioInput: true, CapAudioOutput: true,
		CapEmbedding: true, CapRerank: true, CapReasoning: true,
		CapWebSearch: true, CapVideoInput: true, CapVideoGeneration: true, CapStructuredOutput: true,
	}
}

// IsValidModelCapability checks if a string is a recognized model capability.
func IsValidModelCapability(s string) bool {
	return ValidModelCapabilities()[ModelCapability(s)]
}

// ValidEndpointTypes returns all valid endpoint type constants.
func ValidEndpointTypes() map[EndpointType]bool {
	return map[EndpointType]bool{
		EndpointChatCompletions: true, EndpointImagesGenerations: true,
		EndpointEmbeddings: true, EndpointAudioSpeech: true,
		EndpointAudioTranscription: true, EndpointRerank: true,
		EndpointModerations: true, EndpointResponses: true,
	}
}

// IsValidEndpointType checks if a string is a recognized endpoint type.
func IsValidEndpointType(s string) bool {
	return ValidEndpointTypes()[EndpointType(s)]
}

// Modality 输入/输出模态
type Modality string

const (
	ModalityText  Modality = "text"
	ModalityImage Modality = "image"
	ModalityAudio Modality = "audio"
	ModalityVideo Modality = "video"
)
