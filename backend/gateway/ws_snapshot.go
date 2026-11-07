package main

import (
	"encoding/json"
	"fmt"
	"github.com/gorilla/websocket"
	"github.com/sripadsirik/aurora/shared"
	"time"
)

// Split large catalog snapshots into bounded application messages. Browsers can
// drain these progressively without buffering a single multi-megabyte frame.
func writeSnapshot(conn *websocket.Conn, data []byte) error {
	var msg shared.WSMessage
	if len(data) < 1024*1024 || json.Unmarshal(data, &msg) != nil || msg.Type != "satellites" {
		return conn.WriteMessage(websocket.TextMessage, data)
	}
	var rows []json.RawMessage
	if err := json.Unmarshal(msg.Payload, &rows); err != nil {
		return err
	}
	id := fmt.Sprint(time.Now().UnixNano())
	count := (len(rows) + 499) / 500
	for index := 0; index < count; index++ {
		end := (index + 1) * 500
		if end > len(rows) {
			end = len(rows)
		}
		frame, err := json.Marshal(map[string]any{"type": "satelliteChunk", "id": id, "index": index, "count": count, "rows": rows[index*500 : end]})
		if err != nil {
			return err
		}
		conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
		if err = conn.WriteMessage(websocket.TextMessage, frame); err != nil {
			return err
		}
	}
	return nil
}
