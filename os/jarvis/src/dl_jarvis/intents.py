# Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex.
"""Text liber -> intenție. Doar clasificare; nu execută nimic."""
import re
from dataclasses import dataclass

# De ce tabel: diacriticele lipsesc des din mesaje scrise rapid, deci compar totul fără ele.
_DIACRITICE = str.maketrans("ăâîșşțţ", "aaisstt")


@dataclass(frozen=True)
class Intent:
    kind: str
    arg: str | None = None


def normalize(text: str) -> str:
    text = text.lower().translate(_DIACRITICE)
    return " ".join(re.sub(r"[^\w]+", " ", text).split())


# (kind, [seturi de cuvinte necesare], cuvinte interzise). O regulă se potrivește dacă
# TOATE cuvintele unui set apar în text și niciunul interzis. Ordinea contează: prima câștigă,
# deci oprit/pornit sunt înaintea lui "modul joc" simplu.
_ASK = frozenset({"e", "este", "oare"})
_RULES: list[tuple[str, list[frozenset[str]], frozenset[str]]] = [
    ("help", [frozenset(s) for s in ({"ajutor"}, {"help"}, {"ce", "poti", "face"})], frozenset()),
    ("gamemode_off", [frozenset(s) for s in (
        {"opreste", "joc"}, {"dezactiveaza", "joc"}, {"oprit", "mod", "joc"},
        {"game", "mode", "off"})], _ASK),
    ("gamemode_on", [frozenset(s) for s in (
        {"porneste", "joc"}, {"activeaza", "joc"}, {"pornit", "mod", "joc"},
        {"game", "mode", "on"})], _ASK),
    ("gamemode_status", [frozenset(s) for s in (
        {"mod", "joc"}, {"modul", "joc"}, {"game", "mode"})], frozenset()),
    ("launcher", [frozenset(s) for s in ({"launcher"}, {"launcherul"})], frozenset()),
    ("status", [frozenset(s) for s in (
        {"stare"}, {"starea"}, {"status"}, {"cum", "merge"}, {"memorie"}, {"ram"})], frozenset()),
]


def parse(text: str) -> Intent:
    tokens = set(normalize(text).split())
    for kind, sets, forbidden in _RULES:
        if tokens & forbidden:
            continue
        if any(s <= tokens for s in sets):
            return Intent(kind)
    return Intent("unknown")
