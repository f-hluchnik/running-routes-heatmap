"""Run the JavaScript unit tests (``node --test``) as part of the Python suite."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

JS_TESTS = Path(__file__).parent / "js"


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js is not installed")
def test_javascript_unit_tests_pass():
    test_files = sorted(str(path) for path in JS_TESTS.glob("*.test.mjs"))

    result = subprocess.run(["node", "--test", *test_files], capture_output=True, text=True)

    assert result.returncode == 0, result.stdout + result.stderr
