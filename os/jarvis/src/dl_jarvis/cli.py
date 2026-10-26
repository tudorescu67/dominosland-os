# Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex.
import sys

from . import __version__, actions
from .intents import parse


def run(text: str) -> tuple[int, str]:
    intent = parse(text)
    match intent.kind:
        case "status":
            return actions.status()
        case "gamemode_on":
            return actions.gamemode("on")
        case "gamemode_off":
            return actions.gamemode("off")
        case "gamemode_status":
            return actions.gamemode("status")
        case "launcher":
            return actions.launcher()
        case "help":
            return 0, actions.help_text()
        case _:
            return actions.unknown()


def main(argv=None) -> int:
    args = sys.argv[1:] if argv is None else list(argv)
    if args == ["--version"]:
        print(f"dl-jarvis {__version__}")
        return 0
    if args:
        code, msg = run(" ".join(args))
        print(msg)
        return code
    if not sys.stdin.isatty():
        print("Scrie o comandă, de exemplu: dl-jarvis ajutor", file=sys.stderr)
        return 2
    while True:
        try:
            line = input("Jarvis> ")
        except EOFError:
            print()
            return 0
        if line.strip().lower() in ("ieșire", "iesire"):
            return 0
        if line.strip():
            print(run(line)[1])
