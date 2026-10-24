package main

import (
	satellite "github.com/joshuaferrara/go-satellite"
	"math"
	"testing"
	"time"
)

func TestFractionalEpochMatchesVallado(t *testing.T) {
	rec := gpRecord{NoradCatID: 5, ObjectName: "VANGUARD 1", TLELine1: "1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  4753", TLELine2: "2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667"}
	epoch := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC).Add(time.Duration((179.78495062 - 1) * 86400 * float64(time.Second)))
	got, ok := propagateSatelliteAt(rec, epoch)
	if !ok {
		t.Fatal("failed to propagate")
	}
	gmst := satellite.GSTimeFromDate(epoch.Year(), int(epoch.Month()), epoch.Day(), epoch.Hour(), epoch.Minute(), epoch.Second())
	alt, _, ll := satellite.ECIToLLA(satellite.Vector3{X: 7022.46529266, Y: -1400.08296755, Z: 0.03995155}, gmst)
	if math.Abs(got.Lat-ll.Latitude*180/math.Pi) > 0.0002 || math.Abs(math.Remainder(got.Lon-ll.Longitude*180/math.Pi, 360)) > 0.0002 || math.Abs(got.AltitudeKm-alt) > 0.02 {
		t.Fatalf("reference mismatch: %+v", got)
	}
	if got.TLELine1 != rec.TLELine1 || got.TLELine2 != rec.TLELine2 {
		t.Fatal("original elements not preserved")
	}
}

func TestDebris31029MetadataAndLongitude(t *testing.T) {
	rec := gpRecord{NoradCatID: 31029, ObjectName: "FENGYUN 1C DEB", ObjectType: "DEBRIS", TLELine1: "1 31029U 99025BDX 26296.24052856  .00000557  00000+0  20416-3 0  9999", TLELine2: "2 31029  98.8369 205.7117 0087418 229.3386 283.1512 14.34838306 22998"}
	got, ok := propagateSatelliteAt(rec, time.Date(2026, 10, 23, 18, 19, 59, 0, time.UTC))
	if !ok {
		t.Fatal("propagation failed")
	}
	if got.ObjectType != "DEBRIS" || got.Lon < -180 || got.Lon >= 180 {
		t.Fatalf("metadata or longitude: %+v", got)
	}
	if math.Abs(got.Lon-(-96.84944252278244)) > 0.0001 || math.Abs(got.Lat-(-24.701665340691296)) > 0.0001 {
		t.Fatalf("SGP4 reference mismatch: %+v", got)
	}
}
