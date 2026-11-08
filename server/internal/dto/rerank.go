package dto

// RerankRequest defines the request body for /v1/rerank
type RerankRequest struct {
	Model           string   `json:"model" binding:"required"`
	Query           string   `json:"query" binding:"required"`
	Documents       []string `json:"documents" binding:"required"`
	TopN            *int     `json:"top_n,omitempty"`
	ReturnDocuments *bool    `json:"return_documents,omitempty"`
	MaxChunksPerDoc *int     `json:"max_chunks_per_doc,omitempty"`
	OverlapTokens   *int     `json:"overlap_tokens,omitempty"`
}

// RerankDocumentItem represents a document in rerank results
type RerankDocumentItem struct {
	Text string `json:"text,omitempty"`
}

// RerankResultItem represents a ranked document with score and index
type RerankResultItem struct {
	Index          int                 `json:"index"`
	RelevanceScore float64             `json:"relevance_score"`
	Document       *RerankDocumentItem `json:"document,omitempty"`
}

// RerankUsage represents token usage of a rerank operation
type RerankUsage struct {
	TotalTokens int `json:"total_tokens"`
	PromptTokens int `json:"prompt_tokens,omitempty"`
}

// RerankResponse represents the response for /v1/rerank
type RerankResponse struct {
	ID      string             `json:"id,omitempty"`
	Results []RerankResultItem `json:"results"`
	Usage   *RerankUsage       `json:"usage,omitempty"`
}
