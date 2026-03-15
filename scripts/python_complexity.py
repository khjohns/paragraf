#!/usr/bin/env python3
"""
Syklomatisk kompleksitet per fil og per funksjon i Python-backend.

Wrapper rundt radon CC-analyse med samme output-format som svelte_complexity.py.

Bruk:
  python scripts/python_complexity.py                 # alle filer
  python scripts/python_complexity.py --functions      # vis per-funksjon CC
  python scripts/python_complexity.py --threshold 10   # bare filer over grensen
  python scripts/python_complexity.py --json           # JSON-output

Krever: pip install radon
"""

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

try:
    from radon.complexity import cc_visit
except ImportError:
    print("Feil: 'radon' er ikke installert. Kjør: pip install radon", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).parent.parent
BACKEND_SRC = ROOT / "backend"


def _rating(cc: int) -> str:
    if cc <= 5:
        return "lav"
    if cc <= 10:
        return "moderat"
    if cc <= 20:
        return "høy"
    return "kritisk"


@dataclass
class FunctionResult:
    name: str
    line: int
    cc: int
    classname: str = ""

    @property
    def rating(self) -> str:
        return _rating(self.cc)

    @property
    def display_name(self) -> str:
        if self.classname:
            return f"{self.classname}.{self.name}"
        return self.name


@dataclass
class FileResult:
    path: Path
    cc: int
    lines: int = 0
    functions: list[FunctionResult] = field(default_factory=list)

    @property
    def relative_path(self) -> str:
        try:
            return str(self.path.relative_to(ROOT))
        except ValueError:
            return str(self.path)

    @property
    def rating(self) -> str:
        return _rating(self.cc)


def analyse_file(path: Path) -> FileResult:
    """Analyser en Python-fil med radon CC."""
    src = path.read_text(encoding="utf-8")
    lines = src.count("\n") + 1

    try:
        blocks = cc_visit(src)
    except SyntaxError:
        return FileResult(path=path, cc=1, lines=lines)

    func_results: list[FunctionResult] = []
    for block in blocks:
        classname = ""
        if block.letter == "M":  # Method
            classname = block.classname
        func_results.append(
            FunctionResult(
                name=block.name,
                line=block.lineno,
                cc=block.complexity,
                classname=classname,
            )
        )

    file_cc = max((f.cc for f in func_results), default=1)
    return FileResult(path=path, cc=file_cc, lines=lines, functions=func_results)


RATING_COLOR = {
    "lav": "\033[32m",  # grønn
    "moderat": "\033[33m",  # gul
    "høy": "\033[91m",  # oransje/rød
    "kritisk": "\033[31m",  # rød
}
RESET = "\033[0m"


def print_table(results: list[FileResult], show_functions: bool = False) -> None:
    results = sorted(results, key=lambda r: r.cc, reverse=True)

    col_path = max(len(r.relative_path) for r in results) + 2
    col_path = max(col_path, 40)

    header = f"{'Fil':<{col_path}}  {'CC':>4}  {'Linjer':>6}  Vurdering"
    print(header)
    print("─" * len(header))

    for r in results:
        color = RATING_COLOR.get(r.rating, "")
        cc_str = f"{r.cc:>4}"
        print(
            f"{r.relative_path:<{col_path}}  {color}{cc_str}{RESET}  {r.lines:>6}  {color}{r.rating}{RESET}"
        )
        if show_functions and r.functions:
            funcs = sorted(r.functions, key=lambda f: f.cc, reverse=True)
            for fn in funcs:
                fn_color = RATING_COLOR.get(fn.rating, "")
                fn_label = f"  ƒ {fn.display_name}() L{fn.line}"
                print(f"{fn_label:<{col_path}}  {fn_color}{fn.cc:>4}{RESET}")

    print()
    avg_cc = sum(r.cc for r in results) / len(results) if results else 0
    max_cc = max(r.cc for r in results) if results else 0

    all_funcs = [f for r in results for f in r.functions]
    if all_funcs:
        max_fn = max(all_funcs, key=lambda f: f.cc)
        avg_fn_cc = sum(f.cc for f in all_funcs) / len(all_funcs)
        fn_stats = f"  |  Funksjoner: {len(all_funcs)}  |  Snitt fn-CC: {avg_fn_cc:.1f}  |  Maks fn-CC: {max_fn.cc} ({max_fn.display_name})"
    else:
        fn_stats = ""

    print(
        f"Filer analysert: {len(results)}  |  Gjennomsnitt CC: {avg_cc:.1f}  |  Maks CC: {max_cc}{fn_stats}"
    )
    print()
    print("Skala:  lav ≤5  |  moderat ≤10  |  høy ≤20  |  kritisk >20")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Mål syklomatisk kompleksitet i Python-backend."
    )
    parser.add_argument(
        "--threshold",
        type=int,
        default=0,
        help="Vis kun filer med CC over denne grensen (default: vis alle)",
    )
    parser.add_argument(
        "--functions",
        action="store_true",
        help="Vis syklomatisk kompleksitet per funksjon",
    )
    parser.add_argument("--json", action="store_true", help="Skriv ut som JSON")
    parser.add_argument(
        "--src",
        type=Path,
        default=BACKEND_SRC,
        help=f"Kildemappe (default: {BACKEND_SRC})",
    )
    args = parser.parse_args()

    if not args.src.exists():
        print(f"Feil: Mappen {args.src} finnes ikke.", file=sys.stderr)
        sys.exit(1)

    files = sorted(args.src.rglob("*.py"))

    results = [analyse_file(f) for f in files]

    if args.threshold:
        results = [r for r in results if r.cc > args.threshold]

    if not results:
        print("Ingen filer matchet kriteriene.")
        return

    if args.json:
        output = [
            {
                "fil": r.relative_path,
                "cc": r.cc,
                "linjer": r.lines,
                "vurdering": r.rating,
                "funksjoner": [
                    {
                        "navn": f.display_name,
                        "linje": f.line,
                        "cc": f.cc,
                        "vurdering": f.rating,
                    }
                    for f in sorted(r.functions, key=lambda f: f.cc, reverse=True)
                ],
            }
            for r in sorted(results, key=lambda r: r.cc, reverse=True)
        ]
        print(json.dumps(output, ensure_ascii=False, indent=2))
    else:
        print_table(results, show_functions=args.functions)


if __name__ == "__main__":
    main()
