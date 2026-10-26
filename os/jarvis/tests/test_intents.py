# Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex.
import unittest

from dl_jarvis.intents import normalize, parse

CASES = {
    "status": ["stare", "Status", "cum merge sistemul?", "Starea sistemului", "cât am memorie", "cat am memorie!"],
    "gamemode_on": ["pornește modul joc", "porneste modul joc", "activeaza mod joc", "Activează modul joc!",
                    "mod joc pornit", "game mode on"],
    "gamemode_off": ["oprește modul joc", "opreste modul joc", "dezactiveaza modul joc", "dezactivează modul joc.",
                     "game mode off"],
    "gamemode_status": ["e pornit modul joc", "este pornit modul joc?", "modul joc", "Modul  joc!"],
    "launcher": ["deschide launcherul", "porneste launcher", "launcher", "Pornește launcher-ul"],
    "help": ["ajutor", "Ce poți face?", "ce poti face", "help"],
    "unknown": ["", "fă-mi o cafea", "rm -rf /", "mod"],
}


class IntentTests(unittest.TestCase):
    def test_cases(self):
        for kind, phrases in CASES.items():
            for p in phrases:
                with self.subTest(p=p):
                    self.assertEqual(parse(p).kind, kind)

    def test_normalize(self):
        self.assertEqual(normalize("  Ășț ÎÂ,  ȘŞ ţ! "), "ast ia ss t")

    def test_arg_default(self):
        self.assertIsNone(parse("ajutor").arg)


if __name__ == "__main__":
    unittest.main()
