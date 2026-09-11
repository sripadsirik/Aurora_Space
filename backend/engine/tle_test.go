package main

import "testing"

// A valid ISS (ZARYA) element set: both lines are the canonical 69 characters.
func validISSRecord() gpRecord {
	return gpRecord{
		NoradCatID:   25544,
		TLELine1:     "1 25544U 98067A   08264.51782528 -.00002182  00000-0 -11606-4 0  2927",
		TLELine2:     "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537",
		MeanMotion:   15.72125391,
		Eccentricity: 0.0006703,
	}
}

func TestIsTLEValid(t *testing.T) {
	if !isTLEValid(validISSRecord()) {
		t.Error("a canonical ISS record should be valid")
	}

	t.Run("rejects lines shorter than 69 characters", func(t *testing.T) {
		rec := validISSRecord()
		rec.TLELine1 = "1 25544U 98067A"
		if isTLEValid(rec) {
			t.Error("expected a short line 1 to be rejected")
		}
	})

	t.Run("rejects lines with the wrong leading token", func(t *testing.T) {
		rec := validISSRecord()
		rec.TLELine2 = "X" + rec.TLELine2[1:]
		if isTLEValid(rec) {
			t.Error("expected a line 2 without the '2 ' prefix to be rejected")
		}
	})

	t.Run("rejects hyperbolic or invalid eccentricity", func(t *testing.T) {
		rec := validISSRecord()
		rec.Eccentricity = 1.0
		if isTLEValid(rec) {
			t.Error("expected eccentricity >= 1.0 to be rejected")
		}
		rec.Eccentricity = -0.1
		if isTLEValid(rec) {
			t.Error("expected negative eccentricity to be rejected")
		}
	})

	t.Run("rejects near-parabolic eccentricity that SGP4 cannot handle", func(t *testing.T) {
		rec := validISSRecord()
		rec.Eccentricity = 0.95
		if isTLEValid(rec) {
			t.Error("expected eccentricity > 0.9 to be rejected")
		}
	})

	t.Run("rejects a non-positive mean motion", func(t *testing.T) {
		rec := validISSRecord()
		rec.MeanMotion = 0
		if isTLEValid(rec) {
			t.Error("expected a zero mean motion to be rejected")
		}
	})
}

func TestTLECacheSetSnapshotCount(t *testing.T) {
	cache := &tleCache{records: make(map[string]gpRecord)}

	if cache.count() != 0 {
		t.Fatalf("new cache count = %d, want 0", cache.count())
	}
	if snap := cache.snapshot(); len(snap) != 0 {
		t.Fatalf("new cache snapshot length = %d, want 0", len(snap))
	}

	cache.set("25544", validISSRecord())
	cache.set("48274", gpRecord{NoradCatID: 48274})
	if cache.count() != 2 {
		t.Errorf("count after two inserts = %d, want 2", cache.count())
	}

	// Re-setting an existing key updates in place rather than growing the cache.
	updated := validISSRecord()
	updated.MeanMotion = 15.9
	cache.set("25544", updated)
	if cache.count() != 2 {
		t.Errorf("count after overwrite = %d, want 2", cache.count())
	}

	snap := cache.snapshot()
	if len(snap) != 2 {
		t.Fatalf("snapshot length = %d, want 2", len(snap))
	}
	for _, rec := range snap {
		if rec.NoradCatID == 25544 && rec.MeanMotion != 15.9 {
			t.Errorf("overwritten record not reflected in snapshot: mm=%v", rec.MeanMotion)
		}
	}
}
