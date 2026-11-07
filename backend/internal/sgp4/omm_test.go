package sgp4

import (
	"encoding/json"
	"github.com/sripadsirik/aurora/shared"
	"math"
	"os"
	"testing"
	"time"
)

func TestOMMValladoReference(t *testing.T) {
	raw, err := os.ReadFile("testdata/vallado.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Cases []struct {
			ID      string          `json:"id"`
			OMM     shared.GPRecord `json:"omm"`
			Samples []struct {
				Seconds float64    `json:"seconds"`
				R       [3]float64 `json:"r"`
				V       [3]float64 `json:"v"`
			} `json:"samples"`
		} `json:"cases"`
	}
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	for _, c := range fixture.Cases {
		t.Run(c.ID, func(t *testing.T) {
			s, err := FromOMM(c.OMM)
			if err != nil {
				t.Fatal(err)
			}
			epoch, _ := c.OMM.OMMEpoch()
			for _, sample := range c.Samples {
				p, v, err := At(s, epoch, epoch.Add(time.Duration(sample.Seconds*1e9)))
				if err != nil {
					t.Fatal(err)
				}
				dp := math.Sqrt(math.Pow(p.X-sample.R[0], 2) + math.Pow(p.Y-sample.R[1], 2) + math.Pow(p.Z-sample.R[2], 2))
				dv := math.Sqrt(math.Pow(v.X-sample.V[0], 2) + math.Pow(v.Y-sample.V[1], 2) + math.Pow(v.Z-sample.V[2], 2))
				if dp > 0.001 || dv > 1e-6 {
					t.Errorf("t=%g position error=%g km velocity error=%g km/s", sample.Seconds, dp, dv)
				}
			}
		})
	}
}
