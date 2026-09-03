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
		{"simple pair", "KEY=value", "KEY", "value", true},
		{"trims surrounding whitespace", "  KEY = value  ", "KEY", "value", true},
		{"export prefix stripped", "export KEY=value", "KEY", "value", true},
		{"double quoted value", `KEY="quoted value"`, "KEY", "quoted value", true},
		{"single quoted value", "KEY='quoted value'", "KEY", "quoted value", true},
		{"value with inner equals kept", "KEY=a=b=c", "KEY", "a=b=c", true},
		{"empty value", "KEY=", "KEY", "", true},
		{"blank line skipped", "", "", "", false},
		{"whitespace only skipped", "   ", "", "", false},
		{"comment skipped", "# a comment", "", "", false},
		{"comment with leading space skipped", "   # spaced comment", "", "", false},
		{"missing separator skipped", "NOEQUALS", "", "", false},
		{"empty key skipped", "=value", "", "", false},
		{"empty key after export skipped", "export =value", "", "", false},
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

func TestLoadDotEnvMissingFileReturnsNil(t *testing.T) {
	path := filepath.Join(t.TempDir(), "does-not-exist.env")
	if err := LoadDotEnv(path); err != nil {
		t.Fatalf("LoadDotEnv on missing file returned error: %v", err)
	}
}

func TestLoadDotEnvSetsUnsetVariables(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	content := "# comment\nAURORA_TEST_LOAD_A=alpha\nexport AURORA_TEST_LOAD_B=\"beta\"\n\n"
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write temp env: %v", err)
	}

	os.Unsetenv("AURORA_TEST_LOAD_A")
	os.Unsetenv("AURORA_TEST_LOAD_B")
	t.Cleanup(func() {
		os.Unsetenv("AURORA_TEST_LOAD_A")
		os.Unsetenv("AURORA_TEST_LOAD_B")
	})

	if err := LoadDotEnv(path); err != nil {
		t.Fatalf("LoadDotEnv returned error: %v", err)
	}

	if got := os.Getenv("AURORA_TEST_LOAD_A"); got != "alpha" {
		t.Errorf("AURORA_TEST_LOAD_A = %q, want %q", got, "alpha")
	}
	if got := os.Getenv("AURORA_TEST_LOAD_B"); got != "beta" {
		t.Errorf("AURORA_TEST_LOAD_B = %q, want %q", got, "beta")
	}
}

func TestLoadDotEnvDoesNotOverrideExisting(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	if err := os.WriteFile(path, []byte("AURORA_TEST_EXISTING=fromfile\n"), 0o600); err != nil {
		t.Fatalf("write temp env: %v", err)
	}

	t.Setenv("AURORA_TEST_EXISTING", "preset")

	if err := LoadDotEnv(path); err != nil {
		t.Fatalf("LoadDotEnv returned error: %v", err)
	}

	if got := os.Getenv("AURORA_TEST_EXISTING"); got != "preset" {
		t.Errorf("AURORA_TEST_EXISTING = %q, want %q (existing value preserved)", got, "preset")
	}
}
