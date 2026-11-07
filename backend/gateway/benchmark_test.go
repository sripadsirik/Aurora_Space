package main

import (
	"encoding/json"
	"testing"
)

func BenchmarkBroadcast100Clients(b *testing.B) {
	h := newHub()
	clients := make([]*client, 100)
	for i := range clients {
		clients[i] = &client{send: make(chan []byte, 1)}
		h.register(clients[i])
	}
	payload := json.RawMessage(`{"kpIndex":2,"solarWindSpeed":400,"solarWindDensity":5}`)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		h.broadcast("spaceWeather", payload)
		for _, c := range clients {
			<-c.send
		}
	}
	b.StopTimer()
	for _, c := range clients {
		h.unregister(c)
	}
}
