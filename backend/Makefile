.PHONY: engine-rust

engine-rust:
	cd engine-rust && \
	CC="C:/Users/sripa/mingw64-install/mingw64/bin/gcc.exe" \
	CMAKE="C:/Users/sripa/cmake-install/cmake-3.31.6-windows-x86_64/bin/cmake.exe" \
	cargo build --release && \
	cp target/x86_64-pc-windows-gnu/release/engine-rust.exe ../bin/engine-rust.exe
