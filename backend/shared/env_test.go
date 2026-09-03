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
