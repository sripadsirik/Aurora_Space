package shared

import (
	"testing"
)

func TestParseDotEnvLine(t *testing.T) {
	tests := []struct {
		name      string
		line      string
		wantKey   string
		wantValue string
		wantOK    bool
	}{
		{"simple pair", "FOO=bar", "FOO", "bar", true},
		{"trims surrounding whitespace", "  FOO = bar  ", "FOO", "bar", true},
		{"strips export prefix", "export FOO=bar", "FOO", "bar", true},
		{"double quoted value", `FOO="bar baz"`, "FOO", "bar baz", true},
		{"single quoted value", "FOO='bar baz'", "FOO", "bar baz", true},
		{"value may contain equals", "FOO=a=b=c", "FOO", "a=b=c", true},
		{"empty value is allowed", "FOO=", "FOO", "", true},
		{"blank line rejected", "   ", "", "", false},
		{"comment rejected", "# a comment", "", "", false},
		{"missing separator rejected", "FOO", "", "", false},
		{"leading equals rejected", "=bar", "", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key, value, ok := parseDotEnvLine(tt.line)
			if ok != tt.wantOK {
				t.Fatalf("parseDotEnvLine(%q) ok = %v, want %v", tt.line, ok, tt.wantOK)
			}
			if !tt.wantOK {
				return
			}
			if key != tt.wantKey || value != tt.wantValue {
				t.Errorf("parseDotEnvLine(%q) = (%q, %q), want (%q, %q)", tt.line, key, value, tt.wantKey, tt.wantValue)
			}
		})
	}
}
