.PHONY: engine-rust test vet

# Run the Go unit tests for the shared and service packages.
test:
	go test ./...

# Static analysis for the Go packages.
vet:
	go vet ./...

engine-rust:
	cargo build --release --locked --manifest-path engine-rust/Cargo.toml
