package main

import (
	satellite "github.com/joshuaferrara/go-satellite"
	core "github.com/sripadsirik/aurora/internal/sgp4"
	"github.com/sripadsirik/aurora/shared"
	"math"
	"time"
)

func propagateOMM(rec gpRecord, now time.Time) (*shared.Satellite, bool) {
	s, err := core.FromOMM(rec)
	if err != nil {
		return nil, false
	}
	epoch, _ := rec.OMMEpoch()
	p, v, err := core.At(s, epoch, now)
	if err != nil {
		return nil, false
	}
	// GSTimeFromDate accepts integer seconds; include fractional rotation explicitly.
	gmst := satellite.GSTimeFromDate(now.Year(), int(now.Month()), now.Day(), now.Hour(), now.Minute(), now.Second()) + float64(now.Nanosecond())/1e9*7.29211514670698e-5
	alt, _, ll := satellite.ECIToLLA(satellite.Vector3{X: p.X, Y: p.Y, Z: p.Z}, gmst)
	if alt < 0 || alt > 100000 {
		return nil, false
	}
	regime := shared.ClassifyOrbit(alt)
	if math.Abs(1440/rec.MeanMotion-1436.068) < 15 {
		regime = "GEO"
	}
	return &shared.Satellite{OMM: &rec, NoradID: rec.NoradCatID, Name: rec.ObjectName, ObjectType: rec.ObjectType, PositionTimestamp: now.Format(time.RFC3339Nano), Lat: ll.Latitude * 180 / math.Pi, Lon: math.Mod(ll.Longitude*180/math.Pi+540, 360) - 180, AltitudeKm: alt, VelocityKms: math.Sqrt(v.X*v.X + v.Y*v.Y + v.Z*v.Z), OrbitType: regime, RiskLevel: "nominal"}, true
}
