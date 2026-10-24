package main

import (
	"testing"
	"time"
)

func TestSATCATTypesAndQuotedNames(t *testing.T) {
	rows, err := parseSATCAT([]byte("NORAD_CAT_ID,OBJECT_NAME,OBJECT_TYPE,OWNER,DECAY_DATE,OPS_STATUS_CODE\n31029,\"FENGYUN, FRAGMENT\",DEB,PRC,,\n100001,NEW,PAY,US,,+\n"))
	if err != nil {
		t.Fatal(err)
	}
	if rows[31029].ObjectType != "DEBRIS" || rows[100001].ObjectType != "PAYLOAD" {
		t.Fatal(rows)
	}
}
func TestSATCATRejectsDuplicateIDsAndMalformedRows(t *testing.T) {
	for _, data := range []string{"NORAD_CAT_ID\n1\n", "NORAD_CAT_ID,OBJECT_TYPE,OWNER,DECAY_DATE,OPS_STATUS_CODE\n1,DEB,PRC,,\n1,PAY,US,,\n"} {
		if _, err := parseSATCAT([]byte(data)); err == nil {
			t.Fatal("accepted invalid catalog")
		}
	}
}
func TestOlderElementsCannotReplaceNewer(t *testing.T) {
	c := &tleCache{records: map[string]gpRecord{}}
	old := gpRecord{TLELine1: "1 31029U 99025BDX 26295.24052856  .00000557  00000+0  20416-3 0  9999"}
	newer := old
	newer.TLELine1 = "1 31029U 99025BDX 26296.24052856  .00000557  00000+0  20416-3 0  9999"
	c.set("31029", newer)
	c.set("31029", old)
	if !tleEpoch(c.records["31029"]).After(tleEpoch(old)) {
		t.Fatal("rolled back epoch")
	}
	if tleEpoch(newer).Before(time.Date(2026, 10, 23, 0, 0, 0, 0, time.UTC)) {
		t.Fatal("epoch parse")
	}
}
