package main

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"github.com/sripadsirik/aurora/shared"
)

const satcatURL = "https://celestrak.org/pub/satcat.csv"

type catalogEntry struct{ ObjectType, Owner, DecayDate, Status string }

var catalogMetadata = struct {
	sync.RWMutex
	rows      map[int]catalogEntry
	fetchedAt time.Time
}{}

func parseSATCAT(data []byte) (map[int]catalogEntry, error) {
	reader := csv.NewReader(bytes.NewReader(data))
	header, err := reader.Read()
	if err != nil {
		return nil, err
	}
	fields := map[string]int{}
	for i, key := range header {
		fields[key] = i
	}
	for _, key := range []string{"NORAD_CAT_ID", "OBJECT_TYPE", "OWNER", "DECAY_DATE", "OPS_STATUS_CODE"} {
		if _, ok := fields[key]; !ok {
			return nil, fmt.Errorf("missing SATCAT field %s", key)
		}
	}
	rows := map[int]catalogEntry{}
	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		id, err := strconv.Atoi(row[fields["NORAD_CAT_ID"]])
		if err != nil || id <= 0 {
			return nil, fmt.Errorf("invalid SATCAT ID")
		}
		if _, exists := rows[id]; exists {
			return nil, fmt.Errorf("duplicate SATCAT ID %d", id)
		}
		kind := map[string]string{"PAY": "PAYLOAD", "R/B": "ROCKET BODY", "DEB": "DEBRIS", "UNK": "UNKNOWN"}[row[fields["OBJECT_TYPE"]]]
		if kind == "" {
			kind = "UNKNOWN"
		}
		rows[id] = catalogEntry{kind, row[fields["OWNER"]], row[fields["DECAY_DATE"]], row[fields["OPS_STATUS_CODE"]]}
	}
	return rows, nil
}
func setCatalogMetadata(data []byte, fetched time.Time) error {
	rows, err := parseSATCAT(data)
	if err != nil {
		return err
	}
	if len(rows) < 1000 {
		return fmt.Errorf("incomplete SATCAT: %d rows", len(rows))
	}
	catalogMetadata.Lock()
	catalogMetadata.rows = rows
	catalogMetadata.fetchedAt = fetched
	catalogMetadata.Unlock()
	slog.Info("SATCAT loaded", "objects", len(rows), "fetchedAt", fetched)
	return nil
}
func enrichCatalogObject(s *shared.Satellite) {
	catalogMetadata.RLock()
	row, ok := catalogMetadata.rows[s.NoradID]
	fetched := catalogMetadata.fetchedAt
	catalogMetadata.RUnlock()
	if !ok {
		return
	}
	s.ObjectType = row.ObjectType
	s.Owner = row.Owner
	s.DecayDate = row.DecayDate
	s.OperationalStatus = row.Status
	s.MetadataSource = satcatURL
	s.MetadataFetchedAt = fetched.UTC().Format(time.RFC3339)
}
func startCatalogMetadata(ctx context.Context) {
	path := envOr("SATCAT_CACHE_PATH", "../.aurora/satcat.csv")
	if data, err := os.ReadFile(path); err == nil {
		if stat, err := os.Stat(path); err == nil {
			if err := setCatalogMetadata(data, stat.ModTime()); err != nil {
				slog.Warn("SATCAT cache rejected", "err", err)
			}
		}
	}
	go func() {
		refresh := func() {
			catalogMetadata.RLock()
			fetched := catalogMetadata.fetchedAt
			catalogMetadata.RUnlock()
			if time.Since(fetched) < 24*time.Hour {
				return
			}
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, satcatURL, nil)
			if err != nil {
				return
			}
			req.Header.Set("User-Agent", "AURORA-SSA/1.0")
			response, err := (&http.Client{Timeout: 120 * time.Second}).Do(req)
			if err != nil {
				slog.Warn("SATCAT unavailable", "err", err)
				return
			}
			defer response.Body.Close()
			if response.StatusCode != http.StatusOK {
				slog.Warn("SATCAT unavailable", "status", response.StatusCode)
				return
			}
			data, err := io.ReadAll(io.LimitReader(response.Body, 20_000_001))
			if err != nil || len(data) > 20_000_000 {
				slog.Warn("SATCAT download incomplete")
				return
			}
			if err := setCatalogMetadata(data, time.Now()); err != nil {
				slog.Warn("SATCAT rejected", "err", err)
				return
			}
			if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
				return
			}
			if err := os.WriteFile(path+".tmp", data, 0644); err == nil {
				_ = os.Rename(path+".tmp", path)
			}
		}
		refresh()
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				refresh()
			}
		}
	}()
}
