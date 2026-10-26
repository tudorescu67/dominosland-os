# Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex.
import subprocess
import unittest
from types import SimpleNamespace
from unittest import mock

from dl_jarvis import actions

SAMPLE = {"os": "DominosLand OS", "hostname": "pc", "kernel": "6.12", "uptime_seconds": 7500,
          "load": [0.1, 0.2, 0.3], "memory": {"total_kb": 16355443, "available_kb": 12884902}, "cpus": 8}


class StatusTests(unittest.TestCase):
    def test_format_and_url(self):
        calls = []

        def fetch(url, timeout):
            calls.append((url, timeout))
            return SAMPLE

        with mock.patch.dict("os.environ", {"DOMINOSD_URL": "http://x:1"}):
            code, msg = actions.status(fetch)
        self.assertEqual(code, 0)
        self.assertEqual(calls, [("http://x:1/api/status", 2)])
        for part in ("DominosLand OS", "pc", "2 h 5 min", "3,3 GB din 15,6 GB (21%)"):
            self.assertIn(part, msg)

    def test_unreachable(self):
        def fetch(url, timeout):
            raise OSError("refuz")

        self.assertEqual(actions.status(fetch), (1, "Serviciul de sistem (dominosd) nu răspunde."))

    def test_malformed(self):
        self.assertEqual(actions.status(lambda u, t: {})[0], 1)

    def test_uptime(self):
        self.assertEqual(actions._uptime(300), "5 min")
        self.assertEqual(actions._uptime(90000), "1 zi 1 h 0 min")


class GamemodeTests(unittest.TestCase):
    def test_exact_argv_no_shell(self):
        seen = {}

        def run(args, **kw):
            seen["args"], seen["kw"] = args, kw
            return SimpleNamespace(returncode=0, stdout="pornit\n", stderr="")

        with mock.patch.dict("os.environ", {}, clear=True):
            self.assertEqual(actions.gamemode("on", run), (0, "pornit"))
        self.assertEqual(seen["args"], ["dl-gamemode", "on"])
        self.assertFalse(seen["kw"].get("shell", False))
        self.assertEqual(seen["kw"]["timeout"], 10)

    def test_custom_bin(self):
        seen = []
        with mock.patch.dict("os.environ", {"DL_GAMEMODE_BIN": "/opt/gm"}):
            actions.gamemode("off", lambda a, **k: seen.append(a) or SimpleNamespace(returncode=0, stdout="", stderr=""))
        self.assertEqual(seen, [["/opt/gm", "off"]])

    def test_missing(self):
        def run(*a, **k):
            raise FileNotFoundError

        self.assertEqual(actions.gamemode("status", run), (1, "dl-gamemode nu este instalat."))

    def test_nonzero_passes_stderr(self):
        run = lambda a, **k: SimpleNamespace(returncode=3, stdout="", stderr="eroare x\n")
        self.assertEqual(actions.gamemode("on", run), (3, "eroare x"))

    def test_timeout(self):
        def run(*a, **k):
            raise subprocess.TimeoutExpired("x", 10)

        self.assertEqual(actions.gamemode("on", run)[0], 1)

    def test_rejects_other_cmd(self):
        self.assertEqual(actions.gamemode("; rm -rf /", lambda *a, **k: self.fail("rulat"))[0], 2)


class LauncherTests(unittest.TestCase):
    def test_detached(self):
        seen = {}

        def spawn(args, **kw):
            seen["args"], seen["kw"] = args, kw

        with mock.patch.dict("os.environ", {}, clear=True):
            self.assertEqual(actions.launcher(spawn)[0], 0)
        self.assertEqual(seen["args"], ["dominosland-launcher"])
        self.assertIs(seen["kw"]["start_new_session"], True)
        self.assertEqual(seen["kw"]["stdout"], subprocess.DEVNULL)
        self.assertEqual(seen["kw"]["stderr"], subprocess.DEVNULL)
        self.assertFalse(seen["kw"].get("shell", False))

    def test_missing(self):
        def spawn(*a, **k):
            raise FileNotFoundError

        self.assertEqual(actions.launcher(spawn), (1, "Launcherul DominosLand nu este instalat."))


class MiscTests(unittest.TestCase):
    def test_unknown_and_help(self):
        self.assertEqual(actions.unknown()[0], 2)
        self.assertIn("ajutor", actions.help_text())


if __name__ == "__main__":
    unittest.main()
