# Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex.
"""Acțiunile permise. De ce allowlist: fiecare acțiune e o listă argv fixă, fără shell=True,
ca textul utilizatorului să nu poată ajunge niciodată într-o comandă arbitrară."""
import json
import os
import subprocess
import urllib.request

Result = tuple[int, str]


def _http_fetch(url: str, timeout: float) -> dict:
    with urllib.request.urlopen(url, timeout=timeout) as r:  # noqa: S310 - URL din config locală
        return json.load(r)


def _ro(x: float) -> str:
    return f"{x:.1f}".replace(".", ",")


def _uptime(sec: int) -> str:
    d, rest = divmod(int(sec), 86400)
    h, rest = divmod(rest, 3600)
    m = rest // 60
    parts = ([f"{d} zi" if d == 1 else f"{d} zile"] if d else []) + ([f"{h} h"] if h or d else []) + [f"{m} min"]
    return " ".join(parts)


def status(fetch=_http_fetch) -> Result:
    base = os.environ.get("DOMINOSD_URL", "http://127.0.0.1:7410")
    try:
        d = fetch(f"{base}/api/status", 2)
        total = d["memory"]["total_kb"]
        used = total - d["memory"]["available_kb"]
        gb = 1024 * 1024
        return 0, (
            f"Sistem: {d['os']} (kernel {d['kernel']})\n"
            f"Calculator: {d['hostname']}\n"
            f"Funcționează de: {_uptime(d['uptime_seconds'])}\n"
            f"Memorie: {_ro(used / gb)} GB din {_ro(total / gb)} GB ({round(used * 100 / total)}%)"
        )
    except (OSError, ValueError, KeyError, TypeError, ZeroDivisionError):
        # Și un răspuns malformat înseamnă că serviciul nu e utilizabil.
        return 1, "Serviciul de sistem (dominosd) nu răspunde."


def gamemode(cmd: str, run=subprocess.run) -> Result:
    if cmd not in ("on", "off", "status"):
        return 2, "Comandă necunoscută pentru modul joc."
    try:
        p = run([os.environ.get("DL_GAMEMODE_BIN", "dl-gamemode"), cmd],
                capture_output=True, text=True, timeout=10)
    except FileNotFoundError:
        return 1, "dl-gamemode nu este instalat."
    except subprocess.TimeoutExpired:
        return 1, "dl-gamemode nu a răspuns la timp."
    if p.returncode != 0:
        return p.returncode, (p.stderr or "").strip() or "dl-gamemode a eșuat."
    return 0, (p.stdout or "").strip() or "Gata."


def launcher(spawn=subprocess.Popen) -> Result:
    try:
        spawn([os.environ.get("DL_LAUNCHER_CMD", "dominosland-launcher")],
              start_new_session=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except FileNotFoundError:
        return 1, "Launcherul DominosLand nu este instalat."
    return 0, "Am pornit launcherul DominosLand."


def help_text() -> str:
    return (
        "Pot să fac:\n"
        "  • stare / cum merge sistemul – rezumat despre sistem și memorie\n"
        "  • pornește modul joc / oprește modul joc – comută modul joc\n"
        "  • modul joc – arată dacă modul joc e pornit\n"
        "  • deschide launcherul – pornește launcherul DominosLand\n"
        "  • ajutor – această listă"
    )


def unknown() -> Result:
    return 2, "Nu știu încă să fac asta. Scrie „ajutor” ca să vezi ce pot face."
