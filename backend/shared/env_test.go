package shared

import (
	"os"
	"path/filepath"
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

func writeTempEnv(t *testing.T, contents string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), ".env")
	if err := os.WriteFile(path, []byte(contents), 0o600); err != nil {
		t.Fatalf("write temp env: %v", err)
	}
	return path
}

func TestLoadDotEnvSetsUnsetVariables(t *testing.T) {
	path := writeTempEnv(t, "AURORA_TEST_LOADED=from_file\n# comment\nAURORA_TEST_QUOTED=\"quoted value\"\n")

	os.Unsetenv("AURORA_TEST_LOADED")
	os.Unsetenv("AURORA_TEST_QUOTED")
	t.Cleanup(func() {
		os.Unsetenv("AURORA_TEST_LOADED")
		os.Unsetenv("AURORA_TEST_QUOTED")
	})

	if err := LoadDotEnv(path); err != nil {
		t.Fatalf("LoadDotEnv returned error: %v", err)
	}

	if got := os.Getenv("AURORA_TEST_LOADED"); got != "from_file" {
		t.Errorf("AURORA_TEST_LOADED = %q, want %q", got, "from_file")
	}
	if got := os.Getenv("AURORA_TEST_QUOTED"); got != "quoted value" {
		t.Errorf("AURORA_TEST_QUOTED = %q, want %q", got, "quoted value")
	}
}

func TestLoadDotEnvDoesNotOverrideExisting(t *testing.T) {
	path := writeTempEnv(t, "AURORA_TEST_PRESET=from_file\n")

	t.Setenv("AURORA_TEST_PRESET", "from_environment")

	if err := LoadDotEnv(path); err != nil {
		t.Fatalf("LoadDotEnv returned error: %v", err)
	}

	if got := os.Getenv("AURORA_TEST_PRESET"); got != "from_environment" {
		t.Errorf("AURORA_TEST_PRESET = %q, want existing value preserved", got)
	}
}

func TestLoadDotEnvMissingFileIsNoError(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "does-not-exist.env")
	if err := LoadDotEnv(missing); err != nil {
		t.Errorf("LoadDotEnv(missing) = %v, want nil", err)
	}
}
