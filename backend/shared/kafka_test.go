package shared

import (
	"strings"
	"testing"
)

// TestKafkaTopicsAreDistinctAndNamespaced guards the topic constants that wire
// the ingestion, engine, and gateway services together. A duplicated or
// mis-namespaced topic would silently misroute the pipeline.
func TestKafkaTopicsAreDistinctAndNamespaced(t *testing.T) {
	topics := map[string]string{
		"TopicSatellitesTLE":         TopicSatellitesTLE,
		"TopicSatellitesPositions":   TopicSatellitesPositions,
		"TopicConjunctionsRaw":       TopicConjunctionsRaw,
		"TopicConjunctionsAlerts":    TopicConjunctionsAlerts,
		"TopicSpaceWeatherRaw":       TopicSpaceWeatherRaw,
		"TopicSpaceWeatherProcessed": TopicSpaceWeatherProcessed,
	}

	seen := make(map[string]string, len(topics))
	for name, value := range topics {
		if value == "" {
			t.Errorf("%s is empty", name)
		}
		if !strings.HasPrefix(value, "aurora.") {
			t.Errorf("%s = %q, want prefix %q", name, value, "aurora.")
		}
		if prev, ok := seen[value]; ok {
			t.Errorf("duplicate topic value %q used by both %s and %s", value, prev, name)
		}
		seen[value] = name
	}
}
