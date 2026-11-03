#!/usr/bin/env python3
"""Behavior tests for deploy_function_package.py; no Tencent Cloud calls."""

from __future__ import annotations

import io
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import deploy_function_package as mod  # noqa: E402
from deploy_scf import DeploymentError  # noqa: E402


class BuildPackageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_packs_every_file_and_keeps_exec_bit(self):
        (self.dir / "app.js").write_text("console.log(1)")
        boot = self.dir / "scf_bootstrap"
        boot.write_text("#!/bin/bash\nnode app.js")
        boot.chmod(0o755)
        (self.dir / "sub").mkdir()
        (self.dir / "sub" / "x.txt").write_text("x")

        package = mod.build_package(self.dir)
        with zipfile.ZipFile(io.BytesIO(package)) as archive:
            names = sorted(archive.namelist())
            self.assertEqual(names, ["app.js", "scf_bootstrap", "sub/x.txt"])
            info = archive.getinfo("scf_bootstrap")
            self.assertEqual((info.external_attr >> 16) & 0o777, 0o755)
            plain = archive.getinfo("app.js")
            self.assertEqual((plain.external_attr >> 16) & 0o777, 0o644)

    def test_is_reproducible(self):
        (self.dir / "app.js").write_text("x")
        self.assertEqual(mod.build_package(self.dir), mod.build_package(self.dir))

    def test_empty_directory_is_rejected(self):
        with self.assertRaises(DeploymentError):
            mod.build_package(self.dir)

    def test_missing_directory_is_rejected(self):
        with self.assertRaises(DeploymentError):
            mod.build_package(self.dir / "nope")

    def test_verify_detects_content_drift(self):
        (self.dir / "app.js").write_text("x")
        package = mod.build_package(self.dir)
        (self.dir / "app.js").write_text("y")
        with self.assertRaises(DeploymentError):
            mod.verify_package(self.dir, package)

    def test_verify_detects_missing_file(self):
        (self.dir / "app.js").write_text("x")
        package = mod.build_package(self.dir)
        (self.dir / "extra.js").write_text("z")
        with self.assertRaises(DeploymentError):
            mod.verify_package(self.dir, package)


if __name__ == "__main__":
    unittest.main()
