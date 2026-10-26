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
    def _ok(self, out=""):
        return lambda a, **k: SimpleNamespace(returncode=0, stdout=out, stderr="")

    def test_exact_argv_no_shell(self):
        for cmd, msg in (("on", "Modul joc a fost pornit."), ("off", "Modul joc a fost oprit.")):
            seen = {}

            def run(args, **kw):
                seen["args"], seen["kw"] = args, kw
                return SimpleNamespace(returncode=0, stdout="", stderr="")

            with self.subTest(cmd=cmd), mock.patch.dict("os.environ", {}, clear=True):
                self.assertEqual(actions.gamemode(cmd, run), (0, msg))
                self.assertEqual(seen["args"], ["systemctl", "start", f"dl-gamemode@{cmd}.service"])
                self.assertFalse(seen["kw"].get("shell", False))
                self.assertEqual(seen["kw"]["timeout"], 15)
                self.assertIs(seen["kw"]["capture_output"], True)
                self.assertIs(seen["kw"]["text"], True)

    def test_custom_systemctl(self):
        seen = []
        with mock.patch.dict("os.environ", {"DL_SYSTEMCTL": "/x/sc"}):
            actions.gamemode("off", lambda a, **k: seen.append(a) or SimpleNamespace(returncode=0, stdout="", stderr=""))
        self.assertEqual(seen, [["/x/sc", "start", "dl-gamemode@off.service"]])

    def test_status_argv_and_sentences(self):
        seen = {}

        def run(args, **kw):
            seen["args"], seen["kw"] = args, kw
            return SimpleNamespace(returncode=0, stdout=seen["out"], stderr="")

        with mock.patch.dict("os.environ", {}, clear=True):
            for out, msg in (("pornit\n", "Modul joc este pornit."), ("oprit\n", "Modul joc este oprit.")):
                seen["out"] = out
                self.assertEqual(actions.gamemode("status", run), (0, msg))
                self.assertEqual(seen["args"], ["dl-gamemode", "status"])
                self.assertFalse(seen["kw"].get("shell", False))
        with mock.patch.dict("os.environ", {"DL_GAMEMODE_BIN": "/opt/gm"}):
            actions.gamemode("status", run)
        self.assertEqual(seen["args"], ["/opt/gm", "status"])

    def test_missing_systemctl(self):
        def run(*a, **k):
            raise FileNotFoundError

        self.assertEqual(actions.gamemode("on", run), (1, "systemctl nu este disponibil."))

    def test_nonzero_passes_stderr(self):
        run = lambda a, **k: SimpleNamespace(returncode=3, stdout="", stderr="eroare x\n")
        self.assertEqual(actions.gamemode("on", run), (1, "eroare x"))

    def test_nonzero_generic(self):
        run = lambda a, **k: SimpleNamespace(returncode=4, stdout="", stderr="")
        code, msg = actions.gamemode("off", run)
        self.assertEqual(code, 1)
        self.assertTrue(msg)

    def test_timeout(self):
        def run(*a, **k):
            raise subprocess.TimeoutExpired("x", 15)

        code, msg = actions.gamemode("on", run)
        self.assertEqual(code, 1)
        self.assertIn("la timp", msg)

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
