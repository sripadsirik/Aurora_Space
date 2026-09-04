package shared

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseDotEnvLine(t *testing.T) {
	tests := []struct {
		name    string
		line    string
		wantKey string
		wantVal string
		wantOK  bool
	}{
		{"simple pair", "KEY=value", "KEY", "value", true},
		{"trims surrounding space", "  KEY = value  ", "KEY", "value", true},
		{"export prefix stripped", "export KEY=value", "KEY", "value", true},
		{"double quotes stripped", `KEY="quoted value"`, "KEY", "quoted value", true},
		{"single quotes stripped", "KEY='quoted value'", "KEY", "quoted value", true},
		{"value may contain equals", "KEY=a=b", "KEY", "a=b", true},
		{"empty value allowed", "KEY=", "KEY", "", true},
		{"blank line ignored", "", "", "", false},
		{"whitespace line ignored", "   ", "", "", false},
		{"comment ignored", "# a comment", "", "", false},
		{"missing separator ignored", "NOEQUALS", "", "", false},
		{"empty key ignored", "=value", "", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key, val, ok := parseDotEnvLine(tt.line)
			if ok != tt.wantOK || key != tt.wantKey || val != tt.wantVal {
				t.Errorf("parseDotEnvLine(%q) = (%q, %q, %v), want (%q, %q, %v)",
					tt.line, key, val, ok, tt.wantKey, tt.wantVal, tt.wantOK)
			}
		})
	}
}

func TestLoadDotEnvMissingFileIsNoError(t *testing.T) {
	path := filepath.Join(t.TempDir(), "does-not-exist.env")
	if err := LoadDotEnv(path); err != nil {
		t.Errorf("LoadDotEnv(missing) = %v, want nil", err)
	}
}

func TestLoadDotEnvSetsUnsetVars(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".env")
	contents := "# comment\nAURORA_TEST_KEY=hello\nexport AURORA_TEST_QUOTED=\"spaced value\"\n"
	if err := os.WriteFile(path, []byte(contents), 0o600); err != nil {
		t.Fatalf("write env file: %v", err)
	}

	t.Setenv("AURORA_TEST_KEY", "")
	os.Unsetenv("AURORA_TEST_KEY")
	t.Setenv("AURORA_TEST_QUOTED", "")
	os.Unsetenv("AURORA_TEST_QUOTED")

	if err := LoadDotEnv(path); err != nil {
		t.Fatalf("LoadDotEnv: %v", err)
	}

	if got := os.Getenv("AURORA_TEST_KEY"); got != "hello" {
		t.Errorf("AURORA_TEST_KEY = %q, want %q", got, "hello")
	}
	if got := os.Getenv("AURORA_TEST_QUOTED"); got != "spaced value" {
		t.Errorf("AURORA_TEST_QUOTED = %q, want %q", got, "spaced value")
	}
}

func TestLoadDotEnvDoesNotOverrideExisting(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".env")
	if err := os.WriteFile(path, []byte("AURORA_TEST_EXISTING=fromfile\n"), 0o600); err != nil {
		t.Fatalf("write env file: %v", err)
	}

	t.Setenv("AURORA_TEST_EXISTING", "preset")

	if err := LoadDotEnv(path); err != nil {
		t.Fatalf("LoadDotEnv: %v", err)
	}

	if got := os.Getenv("AURORA_TEST_EXISTING"); got != "preset" {
		t.Errorf("AURORA_TEST_EXISTING = %q, want preset (existing value must win)", got)
	}
}
