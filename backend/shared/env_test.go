package shared

import "testing"

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
