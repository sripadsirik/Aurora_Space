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
		{"trims surrounding whitespace", "  FOO = bar  ", "FOO", "bar", true},
		{"strips an export prefix", "export FOO=bar", "FOO", "bar", true},
		{"keeps double-quoted value unquoted", `FOO="bar baz"`, "FOO", "bar baz", true},
		{"keeps single-quoted value unquoted", "FOO='bar baz'", "FOO", "bar baz", true},
		{"value may contain equals signs", "FOO=a=b=c", "FOO", "a=b=c", true},
		{"empty value is allowed", "FOO=", "FOO", "", true},
		{"blank line is skipped", "   ", "", "", false},
		{"comment line is skipped", "# FOO=bar", "", "", false},
		{"line without separator is skipped", "FOObar", "", "", false},
		{"line starting with equals is skipped", "=bar", "", "", false},
		{"mismatched quotes are left intact", `FOO="bar`, "FOO", `"bar`, true},
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

func TestLoadDotEnvSetsUnsetVariables(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".env")
	contents := "# a comment\nAURORA_TEST_NEW=fromfile\nexport AURORA_TEST_EXPORTED=\"quoted value\"\n"
	if err := os.WriteFile(path, []byte(contents), 0o600); err != nil {
		t.Fatalf("write temp env file: %v", err)
	}

	t.Setenv("AURORA_TEST_NEW", "")
	os.Unsetenv("AURORA_TEST_NEW")
	t.Setenv("AURORA_TEST_EXPORTED", "")
	os.Unsetenv("AURORA_TEST_EXPORTED")

	if err := LoadDotEnv(path); err != nil {
		t.Fatalf("LoadDotEnv returned error: %v", err)
	}

	if got := os.Getenv("AURORA_TEST_NEW"); got != "fromfile" {
		t.Errorf("AURORA_TEST_NEW = %q, want %q", got, "fromfile")
	}
	if got := os.Getenv("AURORA_TEST_EXPORTED"); got != "quoted value" {
		t.Errorf("AURORA_TEST_EXPORTED = %q, want %q", got, "quoted value")
	}
}

func TestLoadDotEnvDoesNotOverrideExisting(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".env")
	if err := os.WriteFile(path, []byte("AURORA_TEST_PRESET=fromfile\n"), 0o600); err != nil {
		t.Fatalf("write temp env file: %v", err)
	}

	t.Setenv("AURORA_TEST_PRESET", "preset")

	if err := LoadDotEnv(path); err != nil {
		t.Fatalf("LoadDotEnv returned error: %v", err)
	}

	if got := os.Getenv("AURORA_TEST_PRESET"); got != "preset" {
		t.Errorf("existing value was overwritten: got %q, want %q", got, "preset")
	}
}

func TestLoadDotEnvMissingFileIsNotAnError(t *testing.T) {
	path := filepath.Join(t.TempDir(), "does-not-exist.env")
	if err := LoadDotEnv(path); err != nil {
		t.Errorf("LoadDotEnv on missing file returned error: %v", err)
	}
}
