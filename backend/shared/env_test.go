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
		{"strips export prefix", "export FOO=bar", "FOO", "bar", true},
		{"double quoted value", `FOO="hello world"`, "FOO", "hello world", true},
		{"single quoted value", "FOO='hello world'", "FOO", "hello world", true},
		{"value may contain equals", "FOO=a=b=c", "FOO", "a=b=c", true},
		{"empty value is allowed", "FOO=", "FOO", "", true},
		{"blank line skipped", "   ", "", "", false},
		{"comment skipped", "# a comment", "", "", false},
		{"missing separator skipped", "NOTAPAIR", "", "", false},
		{"leading equals skipped", "=novalue", "", "", false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			key, value, ok := parseDotEnvLine(tc.line)
			if ok != tc.wantOK {
				t.Fatalf("parseDotEnvLine(%q) ok = %v, want %v", tc.line, ok, tc.wantOK)
			}
			if key != tc.wantKey || value != tc.wantValue {
				t.Errorf("parseDotEnvLine(%q) = (%q, %q), want (%q, %q)", tc.line, key, value, tc.wantKey, tc.wantValue)
			}
		})
	}
}

func TestLoadDotEnvMissingFileIsNoError(t *testing.T) {
	if err := LoadDotEnv(filepath.Join(t.TempDir(), "does-not-exist.env")); err != nil {
		t.Fatalf("LoadDotEnv on missing file returned error: %v", err)
	}
}

func TestLoadDotEnvSetsUnsetVariables(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	contents := "# comment\nAURORA_TEST_FRESH=applied\nexport AURORA_TEST_EXPORTED=\"quoted value\"\n"
	if err := os.WriteFile(path, []byte(contents), 0o600); err != nil {
		t.Fatalf("write temp env: %v", err)
	}

	t.Setenv("AURORA_TEST_FRESH", "")
	os.Unsetenv("AURORA_TEST_FRESH")
	t.Setenv("AURORA_TEST_EXPORTED", "")
	os.Unsetenv("AURORA_TEST_EXPORTED")

	if err := LoadDotEnv(path); err != nil {
		t.Fatalf("LoadDotEnv: %v", err)
	}

	if got := os.Getenv("AURORA_TEST_FRESH"); got != "applied" {
		t.Errorf("AURORA_TEST_FRESH = %q, want %q", got, "applied")
	}
	if got := os.Getenv("AURORA_TEST_EXPORTED"); got != "quoted value" {
		t.Errorf("AURORA_TEST_EXPORTED = %q, want %q", got, "quoted value")
	}
}

func TestLoadDotEnvDoesNotOverrideExisting(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	if err := os.WriteFile(path, []byte("AURORA_TEST_EXISTING=fromfile\n"), 0o600); err != nil {
		t.Fatalf("write temp env: %v", err)
	}

	t.Setenv("AURORA_TEST_EXISTING", "preset")

	if err := LoadDotEnv(path); err != nil {
		t.Fatalf("LoadDotEnv: %v", err)
	}

	if got := os.Getenv("AURORA_TEST_EXISTING"); got != "preset" {
		t.Errorf("AURORA_TEST_EXISTING = %q, want it to stay %q", got, "preset")
	}
}
