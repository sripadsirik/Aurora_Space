package shared

import (
	"fmt"
	"math"
	"strings"
	"time"
)

// GPRecord accepts original TLE records and CelesTrak OMM JSON without ID truncation.
type GPRecord struct {
	Version           string  `json:"CCSDS_OMM_VERS,omitempty"`
	ObjectName        string  `json:"OBJECT_NAME"`
	ObjectID          string  `json:"OBJECT_ID"`
	NoradCatID        int     `json:"NORAD_CAT_ID"`
	ObjectType        string  `json:"OBJECT_TYPE,omitempty"`
	TLELine1          string  `json:"TLE_LINE1,omitempty"`
	TLELine2          string  `json:"TLE_LINE2,omitempty"`
	Epoch             string  `json:"EPOCH,omitempty"`
	MeanMotion        float64 `json:"MEAN_MOTION"`
	Inclination       float64 `json:"INCLINATION"`
	Eccentricity      float64 `json:"ECCENTRICITY"`
	RAOfAscNode       float64 `json:"RA_OF_ASC_NODE"`
	ArgOfPericenter   float64 `json:"ARG_OF_PERICENTER"`
	MeanAnomaly       float64 `json:"MEAN_ANOMALY"`
	BStar             float64 `json:"BSTAR"`
	MeanMotionDot     float64 `json:"MEAN_MOTION_DOT"`
	MeanMotionDDot    float64 `json:"MEAN_MOTION_DDOT"`
	ElementSetNo      int     `json:"ELEMENT_SET_NO"`
	EphemerisType     int     `json:"EPHEMERIS_TYPE"`
	RefFrame          string  `json:"REF_FRAME,omitempty"`
	TimeSystem        string  `json:"TIME_SYSTEM,omitempty"`
	CenterName        string  `json:"CENTER_NAME,omitempty"`
	MeanElementTheory string  `json:"MEAN_ELEMENT_THEORY,omitempty"`
	Period            float64 `json:"PERIOD,omitempty"`
	Apoapsis          float64 `json:"APOAPSIS,omitempty"`
	Periapsis         float64 `json:"PERIAPSIS,omitempty"`
	SemiMajorAxis     float64 `json:"SEMIMAJOR_AXIS,omitempty"`
}

func (r GPRecord) OMMEpoch() (time.Time, error) {
	value := strings.TrimSpace(r.Epoch)
	if !strings.HasSuffix(value, "Z") {
		value += "Z"
	}
	return time.Parse(time.RFC3339Nano, value)
}
func (r GPRecord) ValidateOMM() error {
	if r.Version != "" && !strings.HasPrefix(r.Version, "3.") {
		return fmt.Errorf("unsupported OMM version")
	}
	epoch, err := r.OMMEpoch()
	if err != nil || epoch.Year() < 1957 || epoch.Year() > 2200 {
		return fmt.Errorf("invalid OMM UTC epoch")
	}
	if r.NoradCatID <= 0 || r.NoradCatID > 999999999 {
		return fmt.Errorf("invalid NORAD ID")
	}
	if (r.RefFrame != "" && r.RefFrame != "TEME") || (r.TimeSystem != "" && r.TimeSystem != "UTC") || (r.CenterName != "" && r.CenterName != "EARTH") || (r.MeanElementTheory != "" && r.MeanElementTheory != "SGP4") || r.EphemerisType != 0 {
		return fmt.Errorf("unsupported OMM frame, time system, center or theory")
	}
	for _, v := range []float64{r.MeanMotion, r.Inclination, r.Eccentricity, r.RAOfAscNode, r.ArgOfPericenter, r.MeanAnomaly, r.BStar, r.MeanMotionDot, r.MeanMotionDDot} {
		if math.IsNaN(v) || math.IsInf(v, 0) {
			return fmt.Errorf("nonfinite elements")
		}
	}
	if r.MeanMotion <= 0 || r.MeanMotion > 20 || r.Eccentricity < 0 || r.Eccentricity >= 0.9 || r.Inclination < 0 || r.Inclination > 180 {
		return fmt.Errorf("elements outside supported bounds")
	}
	for _, v := range []float64{r.RAOfAscNode, r.ArgOfPericenter, r.MeanAnomaly} {
		if v < 0 || v >= 360 {
			return fmt.Errorf("invalid angle")
		}
	}
	return nil
}
