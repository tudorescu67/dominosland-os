# Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex.
import io
import unittest
from contextlib import redirect_stdout
from unittest import mock

from dl_jarvis import __version__, actions, cli


def call(argv):
    buf = io.StringIO()
    with redirect_stdout(buf):
        code = cli.main(argv)
    return code, buf.getvalue()


class CliTests(unittest.TestCase):
    def test_help(self):
        code, out = call(["ajutor"])
        self.assertEqual(code, 0)
        self.assertIn("modul joc", out)

    def test_unknown_exit_2(self):
        code, out = call(["zboară"])
        self.assertEqual(code, 2)
        self.assertIn("Nu știu încă", out)

    def test_joins_args_and_dispatches(self):
        with mock.patch.object(actions, "gamemode", return_value=(0, "ok")) as g:
            self.assertEqual(call(["pornește", "modul", "joc"]), (0, "ok\n"))
        g.assert_called_once_with("on")

    def test_status_down(self):
        with mock.patch.dict("os.environ", {"DOMINOSD_URL": "http://127.0.0.1:9"}):
            code, out = call(["stare"])
        self.assertEqual(code, 1)
        self.assertIn("dominosd", out)

    def test_version(self):
        self.assertEqual(call(["--version"]), (0, f"dl-jarvis {__version__}\n"))

    def test_double_dash_text(self):
        code, out = call(["--", "ajutor"])
        self.assertEqual(code, 0)
        self.assertIn("Pot să fac", out)

    def test_double_dash_stare(self):
        with mock.patch.object(actions, "status", return_value=(0, "ok")):
            self.assertEqual(call(["--", "stare"]), (0, "ok\n"))

    def test_double_dash_version_is_text(self):
        code, out = call(["--", "--version"])
        self.assertEqual(code, 2)
        self.assertIn("Nu știu încă", out)

    def test_double_dash_single_arg_with_spaces(self):
        with mock.patch.object(actions, "gamemode", return_value=(0, "ok")) as g:
            call(["--", "-pornește modul joc"])
        g.assert_called_once_with("on")

    def test_repl(self):
        with mock.patch("sys.stdin.isatty", return_value=True),                 mock.patch("builtins.input", side_effect=["ajutor", "iesire"]):
            code, out = call([])
        self.assertEqual(code, 0)
        self.assertIn("Pot să fac", out)

    def test_repl_eof(self):
        with mock.patch("sys.stdin.isatty", return_value=True),                 mock.patch("builtins.input", side_effect=EOFError):
            self.assertEqual(call([])[0], 0)


if __name__ == "__main__":
    unittest.main()
