"""Run backend tests consistently from the repository root on every OS."""

from __future__ import annotations

import os
from pathlib import Path
import sys
import unittest


BACKEND_ROOT = Path(__file__).resolve().parent

# Prefer the project's already-configured virtual environment for local runs.
# CI intentionally has no backend/.venv and uses the Python environment that
# installed requirements.txt instead.
venv_python = BACKEND_ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
if venv_python.exists() and Path(sys.executable).resolve() != venv_python.resolve():
    os.execv(str(venv_python), [str(venv_python), str(Path(__file__).resolve())])

os.chdir(BACKEND_ROOT)
sys.path.insert(0, str(BACKEND_ROOT))

suite = unittest.defaultTestLoader.discover("tests")
test_count = suite.countTestCases()
if test_count == 0:
    raise SystemExit("No backend tests were discovered.")
result = unittest.TextTestRunner(verbosity=2).run(suite)
if result.wasSuccessful():
    print(f"Backend tests passed: {test_count}/{test_count}")
raise SystemExit(0 if result.wasSuccessful() else 1)
