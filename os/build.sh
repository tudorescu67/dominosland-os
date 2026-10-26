#!/usr/bin/env bash
# Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex.
# Construieste componentele DominosLand OS si, la cerere, ISO-ul.
#
#   ./build.sh            compileaza si testeaza componentele (Rust, C++, JavaScript, Python)
#   sudo ./build.sh iso   in plus construieste ISO-ul (doar pe Debian 13, cu live-build)
#
# Componentele se compileaza pe acelasi sistem ca imaginea (Debian 13), ca binarele sa foloseasca
# aceeasi versiune de glibc ca DominosLand OS.
set -euo pipefail

OS_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$OS_DIR/out"
MODE="${1:-components}"

need() {
	command -v "$1" >/dev/null 2>&1 || { echo "Lipseste '$1'. $2" >&2; exit 1; }
}

build_components() {
	need cargo "Instaleaza Rust: https://rustup.rs"
	need cmake "apt install cmake ninja-build g++"
	need ninja "apt install ninja-build"
	need node "apt install nodejs"
	need python3 "apt install python3"

	echo "==> Rust: dominosd"
	(cd "$OS_DIR/services" && cargo test --quiet && cargo build --release --quiet)

	echo "==> C++: dl-gamemode"
	cmake -S "$OS_DIR/engine" -B "$OUT/engine" -G Ninja -DCMAKE_BUILD_TYPE=Release >/dev/null
	cmake --build "$OUT/engine"
	ctest --test-dir "$OUT/engine" --output-on-failure

	echo "==> JavaScript: interfata"
	(cd "$OS_DIR/shell" && node --test)

	echo "==> Python: dl-jarvis"
	(cd "$OS_DIR/jarvis" && PYTHONPATH=src python3 -m unittest discover -s tests)
}

stage_image() {
	# Imaginea se asambleaza intr-o copie, ca binarele compilate sa nu ajunga in git.
	local image="$OUT/image"
	rm -rf "$image"
	cp -a "$OS_DIR/image" "$image"
	local root="$image/config/includes.chroot"

	install -Dm755 "$OS_DIR/services/target/release/dominosd" "$root/usr/local/bin/dominosd"
	install -Dm755 "$OUT/engine/dl-gamemode" "$root/usr/local/bin/dl-gamemode"

	mkdir -p "$root/usr/share/dominosland/shell"
	cp -a "$OS_DIR/shell/index.html" "$OS_DIR/shell/app.js" "$OS_DIR/shell/format.js" \
		"$OS_DIR/shell/style.css" "$OS_DIR/shell/icon.png" "$root/usr/share/dominosland/shell/"

	mkdir -p "$root/usr/lib/python3/dist-packages"
	cp -a "$OS_DIR/jarvis/src/dl_jarvis" "$root/usr/lib/python3/dist-packages/"
	find "$root/usr/lib/python3/dist-packages/dl_jarvis" -name __pycache__ -prune -exec rm -rf {} +
	cat > "$root/usr/local/bin/dl-jarvis" <<'EOF'
#!/usr/bin/python3
from dl_jarvis.cli import main
raise SystemExit(main())
EOF
	chmod 755 "$root/usr/local/bin/dl-jarvis"
	chmod 755 "$image"/auto/* "$image"/config/hooks/normal/*
	echo "$image"
}

build_iso() {
	[ "$(id -u)" -eq 0 ] || { echo "ISO-ul se construieste ca root: sudo ./build.sh iso" >&2; exit 1; }
	need lb "apt install live-build"
	grep -q 'VERSION_CODENAME=trixie' /etc/os-release || {
		echo "ISO-ul se construieste pe Debian 13 (trixie)." >&2
		exit 1
	}
	local image
	image="$(stage_image | tail -n1)"
	(cd "$image" && lb clean && lb config && lb build)
	ls -lh "$image"/*.iso
}

case "$MODE" in
	components) build_components ;;
	iso) build_components && build_iso ;;
	*) echo "Folosire: $0 [components|iso]" >&2; exit 2 ;;
esac
