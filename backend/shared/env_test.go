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
