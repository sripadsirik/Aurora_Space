package shared

import "encoding/json"

// ── Satellite matches frontend/src/types/space.ts Satellite ─────────────────

type Satellite struct {
	NoradID          int     `json:"noradId"`
	Name             string  `json:"name"`
	Lat              float64 `json:"lat"`
	Lon              float64 `json:"lon"`
	AltitudeKm       float64 `json:"altitudeKm"`
	VelocityKms      float64 `json:"velocityKms"`
	OrbitType        string  `json:"orbitType"` // "LEO" | "MEO" | "GEO"
	RiskLevel        string  `json:"riskLevel"` // "nominal" | "watch" | "warning" | "critical"
	Owner            string  `json:"owner"`
	ConjunctionCount int     `json:"conjunctionCount"`
}

type SatelliteBatch struct {
	BatchID    string      `json:"batchId"`
	BatchIndex int         `json:"batchIndex"`
	BatchCount int         `json:"batchCount"`
	Satellites []Satellite `json:"satellites"`
}

// ── ConjunctionWarning matches frontend ConjunctionWarning ──────────────────

type ConjunctionObjectRef struct {
	NoradID int    `json:"noradId"`
	Name    string `json:"name"`
}

type ConjunctionWarning struct {
	ID                  string               `json:"id"`
	Object1             ConjunctionObjectRef `json:"object1"`
	Object2             ConjunctionObjectRef `json:"object2"`
	TCA                 string               `json:"tca"` // ISO8601 — frontend does new Date(tca)
	MissDistanceM       float64              `json:"missDistanceM"`
	Probability         float64              `json:"probability"`
	RelativeVelocityKms float64              `json:"relativeVelocityKms"`
}

// ── SpaceWeather matches frontend SpaceWeather ──────────────────────────────

type SpaceWeather struct {
	KpIndex          float64 `json:"kpIndex"`
	SolarWindSpeed   float64 `json:"solarWindSpeed"`
	SolarWindDensity float64 `json:"solarWindDensity"`
	BzComponent      float64 `json:"bzComponent"`
	XrayFlux         string  `json:"xrayFlux"`   // e.g. "C2.4"
	StormLevel       string  `json:"stormLevel"` // "none" | "minor" | "moderate" | "strong" | "severe" | "extreme"
	AuroraKp         float64 `json:"auroraKp"`
	LastUpdated      string  `json:"lastUpdated"` // ISO8601 — frontend does new Date(lastUpdated)
}

// ── WebSocket message envelope ──────────────────────────────────────────────

type WSMessage struct {
	Type    string          `json:"type"` // "satellites" | "conjunctions" | "spaceWeather" | "connected"
	Payload json.RawMessage `json:"payload"`
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// ClassifyOrbit returns "LEO", "MEO", or "GEO" based on altitude in km.
func ClassifyOrbit(altitudeKm float64) string {
	if altitudeKm < 2000 {
		return "LEO"
	}
	if altitudeKm < 35786 {
		return "MEO"
	}
	return "GEO"
}

// ClassifyRisk derives riskLevel from collision probability.
func ClassifyRisk(probability float64) string {
	if probability > 0.001 {
		return "critical"
	}
	if probability > 0.0001 {
		return "warning"
	}
	if probability > 0.00001 {
		return "watch"
	}
	return "nominal"
}

// DeriveStormLevel converts Kp index to storm level string.
func DeriveStormLevel(kp float64) string {
	if kp >= 9 {
		return "extreme"
	}
	if kp >= 8 {
		return "severe"
	}
	if kp >= 7 {
		return "strong"
	}
	if kp >= 6 {
		return "moderate"
	}
	if kp >= 5 {
		return "minor"
	}
	return "none"
}
