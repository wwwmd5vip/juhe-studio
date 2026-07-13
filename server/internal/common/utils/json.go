package utils

import "encoding/json"

func StringifyJSON(v interface{}) *string {
	if v == nil {
		return nil
	}
	switch data := v.(type) {
	case string:
		if data == "" {
			return nil
		}
		return &data
	default:
		b, err := json.Marshal(v)
		if err != nil {
			return nil
		}
		s := string(b)
		if s == "null" || s == "[]" || s == "{}" {
			return nil
		}
		return &s
	}
}

func ParseJSONString(s *string, v interface{}) {
	if s == nil || *s == "" {
		return
	}
	_ = json.Unmarshal([]byte(*s), v)
}
