"""Every LIKE pattern in the API's SQL doubles its % wildcard. Reads source; no database.

Run from apps/backend: python -m unittest discover -s tests/unit -v

psycopg parses % as a placeholder whenever a query has parameters, so `like 'x%'` raises
"only '%s', '%b', '%t' are allowed as placeholders" at request time — it broke
/admin/analytics/comparison outright. Written as %%, a pattern is correct with or without
parameters (in LIKE, %% is two wildcards and matches the same as %), so the rule is simply
"always double it".
"""
import pathlib
import re
import unittest

BACKEND = pathlib.Path(__file__).resolve().parent.parent.parent
SOURCES = sorted([*BACKEND.glob("routes/*.py"), *BACKEND.glob("services/**/*.py"), BACKEND / "auth.py"])
LIKE = re.compile(r"\b(?:i?like)\s+'([^']*)'", re.IGNORECASE)


class LikePatternTests(unittest.TestCase):
    def test_every_like_wildcard_is_escaped_for_psycopg(self):
        offenders = []
        for path in SOURCES:
            for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                for pattern in LIKE.findall(line):
                    # Remove the escaped pairs; any % left over is a lone one.
                    if "%" in pattern.replace("%%", ""):
                        offenders.append(f"{path.relative_to(BACKEND)}:{lineno}: like '{pattern}'")
        self.assertEqual(offenders, [], "write LIKE wildcards as %%:\n" + "\n".join(offenders))

    def test_the_scan_actually_finds_like_patterns(self):
        # Guards the guard: if the regex ever stops matching, the test above passes vacuously.
        found = [p for path in SOURCES for p in LIKE.findall(path.read_text(encoding="utf-8"))]
        self.assertGreaterEqual(len(found), 3, found)


if __name__ == "__main__":
    unittest.main()
