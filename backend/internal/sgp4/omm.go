package sgp4

import (
	"fmt"
	"github.com/sripadsirik/aurora/shared"
	"math"
	"time"
)

// FromOMM initializes WGS72 SGP4 directly from numeric mean elements. Preserves
// six/nine-digit IDs and fractional epoch seconds; never rounds through a TLE.
func FromOMM(r shared.GPRecord) (Satellite, error) {
	if err := r.ValidateOMM(); err != nil {
		return Satellite{}, err
	}
	epoch, _ := r.OMMEpoch()
	jd := 2440587.5 + float64(epoch.Unix())/86400 + float64(epoch.Nanosecond())/86400e9
	s := Satellite{satnum: int64(r.NoradCatID), whichconst: getGravConst(GravityWGS72), jdsatepoch: jd,
		no: r.MeanMotion / XPDOTP, ndot: r.MeanMotionDot / (XPDOTP * 1440), nddot: r.MeanMotionDDot / (XPDOTP * 1440 * 1440),
		bstar: r.BStar, inclo: r.Inclination * DEG2RAD, nodeo: r.RAOfAscNode * DEG2RAD, ecco: r.Eccentricity, argpo: r.ArgOfPericenter * DEG2RAD, mo: r.MeanAnomaly * DEG2RAD}
	mode := "i"
	sgp4init(&mode, jd-2433281.5, &s)
	if s.Error != 0 {
		return Satellite{}, fmt.Errorf("SGP4 initialization: %s", s.ErrorStr)
	}
	return s, nil
}
func At(s Satellite, epoch, at time.Time) (Vector3, Vector3, error) {
	p, v := sgp4(&s, at.Sub(epoch).Seconds()/60)
	if s.Error != 0 {
		return p, v, fmt.Errorf("SGP4 propagation: %s", s.ErrorStr)
	}
	for _, x := range []float64{p.X, p.Y, p.Z, v.X, v.Y, v.Z} {
		if math.IsNaN(x) || math.IsInf(x, 0) {
			return p, v, fmt.Errorf("nonfinite state")
		}
	}
	return p, v, nil
}
