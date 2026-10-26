#!/bin/sh
# Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex.
# Testeaza alegerea utilizatorului pentru interfata, cu fisiere passwd false.
set -eu

HERE="$(cd "$(dirname "$0")" && pwd)"
GEN="$HERE/../config/includes.chroot/usr/lib/systemd/system-generators/dominosland-user-generator"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fails=0

check() {
	name="$1"; passwd="$2"; want="$3"
	printf '%s' "$passwd" > "$TMP/passwd"
	rm -rf "$TMP/out"; mkdir -p "$TMP/out"
	DL_PASSWD="$TMP/passwd" sh "$GEN" "$TMP/out" "$TMP/out" "$TMP/out"
	got="$(sed -n 's/^User=//p' "$TMP/out/dominosland-shell.service.d/50-user.conf")"
	if [ "$got" = "$want" ]; then
		echo "ok   - $name"
	else
		echo "FAIL - $name: astept '$want', am primit '$got'"
		fails=$((fails + 1))
	fi
}

check "live: doar root si utilizatori de sistem" \
	'root:x:0:0::/root:/bin/bash
daemon:x:1:1::/usr/sbin:/usr/sbin/nologin
' dominos

check "instalat: utilizatorul ales in installer" \
	'root:x:0:0::/root:/bin/bash
alex:x:1000:1000::/home/alex:/bin/bash
' alex

check "cel mai mic UID castiga, nu ordinea din fisier" \
	'maria:x:1001:1001::/home/maria:/bin/bash
alex:x:1000:1000::/home/alex:/bin/bash
' alex

check "conturile fara login sunt ignorate" \
	'svc:x:1000:1000::/srv:/usr/sbin/nologin
alex:x:1002:1002::/home/alex:/bin/bash
' alex

check "nobody (65534) nu e utilizator real" \
	'nobody:x:65534:65534::/nonexistent:/bin/sh
' dominos

check "nume invalid -> rezerva" \
	'Bad$Name:x:1000:1000::/home/x:/bin/bash
' dominos

check "fisier passwd lipsa -> rezerva" '' dominos

[ "$fails" -eq 0 ] || { echo "$fails teste picate"; exit 1; }
echo "toate testele au trecut"
