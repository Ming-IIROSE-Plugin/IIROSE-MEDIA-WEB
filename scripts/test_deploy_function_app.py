#!/usr/bin/env python3
"""Behavior tests for deploy_function_app.py; no Tencent Cloud calls."""

from __future__ import annotations

import io
import sys
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import deploy_function_app as mod  # noqa: E402
from deploy_scf import DeploymentError  # noqa: E402


def make_package(app: bytes = b"old app", prefix: str = "") -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.comment = b"keep me"
        archive.writestr(f"{prefix}app.js", app, compress_type=zipfile.ZIP_DEFLATED)
        archive.writestr(
            f"{prefix}node_modules/x/index.js",
            b"module",
            compress_type=zipfile.ZIP_STORED,
        )
        archive.writestr(
            f"{prefix}package.json", b"{}", compress_type=zipfile.ZIP_DEFLATED
        )
    return output.getvalue()


class ReplaceAppTests(unittest.TestCase):
    def test_replaces_app_and_keeps_other_files(self):
        updated = mod.replace_app(make_package(), b"new app")
        with zipfile.ZipFile(io.BytesIO(updated)) as archive:
            self.assertEqual(archive.read("app.js"), b"new app")
            self.assertEqual(archive.read("node_modules/x/index.js"), b"module")
            self.assertEqual(archive.read("package.json"), b"{}")

    def test_supports_src_layout(self):
        updated = mod.replace_app(make_package(prefix="src/"), b"new app")
        with zipfile.ZipFile(io.BytesIO(updated)) as archive:
            self.assertEqual(archive.read("src/app.js"), b"new app")
            self.assertNotIn("app.js", archive.namelist())

    def test_empty_app_is_rejected(self):
        with self.assertRaises(DeploymentError):
            mod.replace_app(make_package(), b"")

    def test_missing_app_is_rejected(self):
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            archive.writestr("index.js", b"x")
        with self.assertRaises(DeploymentError):
            mod.replace_app(output.getvalue(), b"new app")

    def test_ambiguous_layout_is_rejected(self):
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            archive.writestr("app.js", b"a")
            archive.writestr("src/app.js", b"b")
        with self.assertRaises(DeploymentError):
            mod.replace_app(output.getvalue(), b"new app")

    def test_verify_detects_wrong_content(self):
        original = make_package()
        updated = mod.replace_app(original, b"new app")
        with self.assertRaises(DeploymentError):
            mod.verify_app_update(original, updated, b"different")


if __name__ == "__main__":
    unittest.main()
