package captcha

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"log"
	"math/big"
	"strings"
	"sync"
	"time"
)

const (
	width          = 120
	height         = 40
	codeLen        = 4
	ttl            = 5 * time.Minute
	cleanupIntv    = 60 * time.Second
	maxStoreEntries = 10000 // prevent unbounded memory growth from DoS
)

// charset excludes easily confused characters (0/O, 1/I/l)
const charset = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"

// 5x7 pixel font for A-Z, a-z, 0-9 (subset, built on demand)
// Using a compact dot-matrix representation
var font5x7 = map[byte][]string{
	'A': {"01110", "10001", "10001", "11111", "10001", "10001", "10001"},
	'B': {"11110", "10001", "10001", "11110", "10001", "10001", "11110"},
	'C': {"01110", "10001", "10000", "10000", "10000", "10001", "01110"},
	'D': {"11110", "10001", "10001", "10001", "10001", "10001", "11110"},
	'E': {"11111", "10000", "10000", "11110", "10000", "10000", "11111"},
	'F': {"11111", "10000", "10000", "11110", "10000", "10000", "10000"},
	'G': {"01110", "10001", "10000", "10111", "10001", "10001", "01111"},
	'H': {"10001", "10001", "10001", "11111", "10001", "10001", "10001"},
	'J': {"00111", "00010", "00010", "00010", "00010", "10010", "01100"},
	'K': {"10001", "10010", "10100", "11000", "10100", "10010", "10001"},
	'M': {"10001", "11011", "10101", "10101", "10001", "10001", "10001"},
	'N': {"10001", "11001", "10101", "10011", "10001", "10001", "10001"},
	'P': {"11110", "10001", "10001", "11110", "10000", "10000", "10000"},
	'Q': {"01110", "10001", "10001", "10001", "10101", "10010", "01101"},
	'R': {"11110", "10001", "10001", "11110", "10100", "10010", "10001"},
	'S': {"01111", "10000", "10000", "01110", "00001", "00001", "11110"},
	'T': {"11111", "00100", "00100", "00100", "00100", "00100", "00100"},
	'V': {"10001", "10001", "10001", "10001", "10001", "01010", "00100"},
	'W': {"10001", "10001", "10001", "10101", "10101", "10101", "01010"},
	'X': {"10001", "10001", "01010", "00100", "01010", "10001", "10001"},
	'Y': {"10001", "10001", "01010", "00100", "00100", "00100", "00100"},
	'Z': {"11111", "00001", "00010", "00100", "01000", "10000", "11111"},
	'a': {"00000", "00000", "01110", "00001", "01111", "10001", "01111"},
	'b': {"10000", "10000", "10110", "11001", "10001", "10001", "11110"},
	'c': {"00000", "00000", "01110", "10000", "10000", "10001", "01110"},
	'd': {"00001", "00001", "01101", "10011", "10001", "10001", "01111"},
	'e': {"00000", "00000", "01110", "10001", "11111", "10000", "01110"},
	'f': {"00110", "01001", "01000", "11110", "01000", "01000", "01000"},
	'g': {"00000", "01111", "10001", "10001", "01111", "00001", "01110"},
	'h': {"10000", "10000", "10110", "11001", "10001", "10001", "10001"},
	'j': {"00010", "00000", "00110", "00010", "00010", "10010", "01100"},
	'k': {"10000", "10000", "10010", "10100", "11000", "10100", "10010"},
	'm': {"00000", "00000", "11010", "10101", "10101", "10001", "10001"},
	'n': {"00000", "00000", "10110", "11001", "10001", "10001", "10001"},
	'p': {"00000", "00000", "10110", "11001", "11110", "10000", "10000"},
	'q': {"00000", "00000", "01101", "10011", "01111", "00001", "00001"},
	'r': {"00000", "00000", "10110", "11001", "10000", "10000", "10000"},
	's': {"00000", "00000", "01111", "10000", "01110", "00001", "11110"},
	't': {"01000", "01000", "11110", "01000", "01000", "01001", "00110"},
	'v': {"00000", "00000", "10001", "10001", "10001", "01010", "00100"},
	'w': {"00000", "00000", "10001", "10001", "10101", "10101", "01010"},
	'x': {"00000", "00000", "10001", "01010", "00100", "01010", "10001"},
	'y': {"00000", "00000", "10001", "10001", "01111", "00001", "01110"},
	'z': {"00000", "00000", "11111", "00010", "00100", "01000", "11111"},
	'2': {"01110", "10001", "00001", "00010", "00100", "01000", "11111"},
	'3': {"01110", "10001", "00001", "00110", "00001", "10001", "01110"},
	'4': {"00010", "00110", "01010", "10010", "11111", "00010", "00010"},
	'5': {"11111", "10000", "11110", "00001", "00001", "10001", "01110"},
	'6': {"00110", "01000", "10000", "11110", "10001", "10001", "01110"},
	'7': {"11111", "00001", "00010", "00100", "01000", "01000", "01000"},
	'8': {"01110", "10001", "10001", "01110", "10001", "10001", "01110"},
	'9': {"01110", "10001", "10001", "01111", "00001", "00010", "01100"},
}

type entry struct {
	code     string
	expireAt time.Time
}

// Store is an in-memory captcha store with TTL-based expiry.
type Store struct {
	mu      sync.RWMutex
	entries map[string]*entry
	stop    chan struct{}
}

func NewStore() *Store {
	s := &Store{
		entries: make(map[string]*entry),
		stop:    make(chan struct{}),
	}
	go s.cleanupLoop()
	return s
}

// Close stops the background cleanup goroutine.
func (s *Store) Close() {
	select {
	case <-s.stop:
		// already closed
	default:
		close(s.stop)
	}
}

func (s *Store) cleanupLoop() {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("panic in captcha cleanup goroutine: %v", r)
		}
	}()
	ticker := time.NewTicker(cleanupIntv)
	defer ticker.Stop()
	for {
		select {
		case <-s.stop:
			return
		case <-ticker.C:
			now := time.Now()
			s.mu.Lock()
			for id, e := range s.entries {
				if now.After(e.expireAt) {
					delete(s.entries, id)
				}
			}
			s.mu.Unlock()
		}
	}
}

// Generate creates a new captcha, returns (id, code, base64PNGDataURI).
// Returns empty strings when the store is overloaded to prevent OOM.
func (s *Store) Generate() (string, string, string) {
	s.mu.Lock()
	if len(s.entries) >= maxStoreEntries {
		s.mu.Unlock()
		return "", "", "" // rate-limited: store is full
	}
	code := randomCode(codeLen)
	id := randomID(16)
	s.entries[id] = &entry{code: code, expireAt: time.Now().Add(ttl)}
	s.mu.Unlock()

	pngBytes := renderImage(code)
	b64 := base64.StdEncoding.EncodeToString(pngBytes)
	return id, code, "data:image/png;base64," + b64
}

// Verify checks the captcha code WITHOUT deleting it, allowing retries on wrong password.
// Only call Consume after a successful login to invalidate the captcha.
func (s *Store) Verify(id, code string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	e, ok := s.entries[id]
	if !ok {
		return false
	}

	if time.Now().After(e.expireAt) {
		return false
	}
	return strings.EqualFold(e.code, code)
}

// Consume deletes a captcha entry after successful use (e.g. login success).
func (s *Store) Consume(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.entries, id)
}

func randomCode(n int) string {
	b := make([]byte, n)
	max := big.NewInt(int64(len(charset)))
	for i := range b {
		r, _ := rand.Int(rand.Reader, max)
		b[i] = charset[r.Int64()]
	}
	return string(b)
}

func randomID(n int) string {
	const hex = "0123456789abcdef"
	b := make([]byte, n)
	max := big.NewInt(int64(len(hex)))
	for i := range b {
		r, _ := rand.Int(rand.Reader, max)
		b[i] = hex[r.Int64()]
	}
	return string(b)
}

// renderImage draws a captcha PNG with noise and the code text.
func renderImage(code string) []byte {
	img := image.NewRGBA(image.Rect(0, 0, width, height))

	// Background — light random color
	bg := color.RGBA{
		R: uint8(randInt(220, 250)),
		G: uint8(randInt(220, 250)),
		B: uint8(randInt(220, 250)),
		A: 255,
	}
	draw.Draw(img, img.Bounds(), &image.Uniform{C: bg}, image.Point{}, draw.Src)

	// Draw noise dots
	for i := 0; i < 80; i++ {
		x := randInt(0, width)
		y := randInt(0, height)
		img.Set(x, y, randomColor(100, 200))
	}

	// Draw noise lines
	for i := 0; i < 4; i++ {
		x1, y1 := randInt(0, width), randInt(0, height)
		x2, y2 := randInt(0, width), randInt(0, height)
		drawLine(img, x1, y1, x2, y2, randomColor(120, 200))
	}

	// Draw each character using 5x7 dot matrix
	charW := 5
	charH := 7
	scale := 3
	startX := (width - codeLen*charW*scale - (codeLen-1)*2) / 2
	for i, ch := range code {
		font, ok := font5x7[byte(ch)]
		if !ok {
			continue
		}
		// Slight vertical jitter per character
		offsetY := randInt(2, 8)
		fg := randomColor(0, 120)
		for row := 0; row < charH; row++ {
			for col := 0; col < charW; col++ {
				if font[row][col] == '1' {
					for dy := 0; dy < scale; dy++ {
						for dx := 0; dx < scale; dx++ {
							px := startX + i*(charW*scale+2) + col*scale + dx
							py := offsetY + row*scale + dy
							if px >= 0 && px < width && py >= 0 && py < height {
								img.Set(px, py, fg)
							}
						}
					}
				}
			}
		}
	}

	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	return buf.Bytes()
}

func drawLine(img *image.RGBA, x1, y1, x2, y2 int, c color.Color) {
	dx := abs(x2 - x1)
	dy := abs(y2 - y1)
	sx := 1
	if x1 > x2 {
		sx = -1
	}
	sy := 1
	if y1 > y2 {
		sy = -1
	}
	err := dx - dy
	for {
		if x1 >= 0 && x1 < width && y1 >= 0 && y1 < height {
			img.Set(x1, y1, c)
		}
		if x1 == x2 && y1 == y2 {
			break
		}
		e2 := 2 * err
		if e2 > -dy {
			err -= dy
			x1 += sx
		}
		if e2 < dx {
			err += dx
			y1 += sy
		}
	}
}

func randomColor(min, max int) color.RGBA {
	return color.RGBA{
		R: uint8(randInt(min, max)),
		G: uint8(randInt(min, max)),
		B: uint8(randInt(min, max)),
		A: 255,
	}
}

func randInt(min, max int) int {
	if min >= max {
		return min
	}
	n, _ := rand.Int(rand.Reader, big.NewInt(int64(max-min)))
	return min + int(n.Int64())
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

// FormatDataURI is a helper for testing.
func FormatDataURI(pngBytes []byte) string {
	return fmt.Sprintf("data:image/png;base64,%s", base64.StdEncoding.EncodeToString(pngBytes))
}
