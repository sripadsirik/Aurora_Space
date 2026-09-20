package shared

import (
	"os"
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
		{"trims surrounding space", "  FOO = bar  ", "FOO", "bar", true},
		{"strips export prefix", "export FOO=bar", "FOO", "bar", true},
		{"double-quoted value", `FOO="bar baz"`, "FOO", "bar baz", true},
		{"single-quoted value", "FOO='bar baz'", "FOO", "bar baz", true},
		{"empty value allowed", "FOO=", "FOO", "", true},
		{"value may contain equals", "URL=a=b", "URL", "a=b", true},
		{"blank line skipped", "   ", "", "", false},
		{"comment skipped", "# a comment", "", "", false},
		{"missing separator skipped", "FOO", "", "", false},
		{"leading equals skipped", "=bar", "", "", false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			key, value, ok := parseDotEnvLine(tc.line)
			if ok != tc.wantOK {
				t.Fatalf("parseDotEnvLine(%q) ok = %v, want %v", tc.line, ok, tc.wantOK)
			}
			if !tc.wantOK {
				return
			}
			if key != tc.wantKey || value != tc.wantValue {
				t.Errorf("parseDotEnvLine(%q) = (%q, %q), want (%q, %q)", tc.line, key, value, tc.wantKey, tc.wantValue)
			}
		})
	}
}

func TestLoadDotEnvSetsUnsetKeys(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".env")
	contents := "# header comment\nEXPORTED=export me\nexport WITH_PREFIX=prefixed\nQUOTED=\"spaced value\"\n\nBLANK_SKIPPED\n"
	if err := os.WriteFile(path, []byte(contents), 0o600); err != nil {
		t.Fatalf("write temp env: %v", err)
	}

	for _, key := range []string{"EXPORTED", "WITH_PREFIX", "QUOTED"} {
		t.Setenv(key, "")
		os.Unsetenv(key)
	}

	if err := LoadDotEnv(path); err != nil {
		t.Fatalf("LoadDotEnv returned error: %v", err)
	}

	want := map[string]string{
		"EXPORTED":    "export me",
		"WITH_PREFIX": "prefixed",
		"QUOTED":      "spaced value",
	}
	for key, expected := range want {
		if got := os.Getenv(key); got != expected {
			t.Errorf("after LoadDotEnv, %s = %q, want %q", key, got, expected)
		}
	}
}

func TestLoadDotEnvDoesNotOverrideExisting(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".env")
	if err := os.WriteFile(path, []byte("PRESET=fromfile\n"), 0o600); err != nil {
		t.Fatalf("write temp env: %v", err)
	}

	t.Setenv("PRESET", "fromenv")
	if err := LoadDotEnv(path); err != nil {
		t.Fatalf("LoadDotEnv returned error: %v", err)
	}
	if got := os.Getenv("PRESET"); got != "fromenv" {
		t.Errorf("LoadDotEnv overrode existing value: got %q, want %q", got, "fromenv")
	}
}

func TestLoadDotEnvMissingFileIsNoError(t *testing.T) {
	if err := LoadDotEnv(filepath.Join(t.TempDir(), "does-not-exist.env")); err != nil {
		t.Errorf("LoadDotEnv on missing file = %v, want nil", err)
	}
}
