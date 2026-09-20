package shared

import "testing"

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
