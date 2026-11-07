# SGP4 core attribution

Core copied without algorithm changes from github.com/joshuaferrara/go-satellite,
commit 512638c64e5b (2022-06-11), under the included MIT license.
Only package name changed. `omm.go` is the Aurora adapter: direct numeric mean
elements and fractional UTC epochs, without serializing through limited-width TLEs.
This local copy is necessary because the upstream initializer and elements are
private. Keep upstream source changes separate from adapter changes.
