package shared

import (
	"path/filepath"
	"testing"
)

func TestParseDotEnvLine(t *testing.T) {
	cases := []struct {
		name      string
		line      string
		wantKey   string
		wantValue string
		wantOK    bool
	}{
		{"simple pair", "FOO=bar", "FOO", "bar", true},
		{"trims surrounding spaces", "  FOO = bar  ", "FOO", "bar", true},
		{"strips export prefix", "export FOO=bar", "FOO", "bar", true},
		{"double-quoted value", `FOO="bar baz"`, "FOO", "bar baz", true},
		{"single-quoted value", "FOO='bar baz'", "FOO", "bar baz", true},
		{"value may contain equals", "URL=a=b=c", "URL", "a=b=c", true},
		{"empty value is allowed", "FOO=", "FOO", "", true},
		{"blank line skipped", "   ", "", "", false},
		{"comment skipped", "# a comment", "", "", false},
		{"missing separator skipped", "NOEQUALS", "", "", false},
		{"leading equals skipped", "=value", "", "", false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			key, value, ok := parseDotEnvLine(tc.line)
			if ok != tc.wantOK || key != tc.wantKey || value != tc.wantValue {
				t.Errorf("parseDotEnvLine(%q) = (%q, %q, %v), want (%q, %q, %v)",
					tc.line, key, value, ok, tc.wantKey, tc.wantValue, tc.wantOK)
			}
		})
	}
}

func TestLoadDotEnvMissingFileIsNoError(t *testing.T) {
	path := filepath.Join(t.TempDir(), "does-not-exist.env")
	if err := LoadDotEnv(path); err != nil {
		t.Fatalf("LoadDotEnv(missing) returned error: %v", err)
	}
}
