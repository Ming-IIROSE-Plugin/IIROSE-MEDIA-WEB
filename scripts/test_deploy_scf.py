#!/usr/bin/env python3
"""Behavior tests for deploy_scf.py; all tests run without Tencent Cloud calls."""

from __future__ import annotations

import base64
import copy
import io
import sys
import unittest
import zipfile
import warnings
from contextlib import redirect_stderr
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).parent))
import deploy_scf  # noqa: E402


def make_package(bundle: bytes = b"old bundle") -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.comment = b"preserve archive comment"
        archive.writestr("src/app.js", b"handler", compress_type=zipfile.ZIP_DEFLATED)
        archive.writestr("src/bundle.js", bundle, compress_type=zipfile.ZIP_DEFLATED)
        archive.writestr(
            "config.json", b'{"keep": true}', compress_type=zipfile.ZIP_STORED
        )
        entry = zipfile.ZipInfo("src/helper.sh", date_time=(2025, 7, 10, 12, 0, 0))
        entry.comment = b"entry comment"
        entry.external_attr = 0o100755 << 16
        entry.extra = b"\xfe\xca\x02\x00ok"
        archive.writestr(entry, b"#!/bin/sh\nexit 0")
    return output.getvalue()


class FakeAddressClient:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.requests = []

    def GetFunctionAddress(self, request):
        self.requests.append(request)
        return SimpleNamespace(Response=SimpleNamespace(Url=next(self.responses)))


class FakeFunctionClient:
    def __init__(self, responses):
        self.responses = iter(responses)

    def GetFunction(self, request):
        return SimpleNamespace(Response=next(self.responses))


class DeployScfTests(unittest.TestCase):
    def setUp(self):
        models = SimpleNamespace(
            GetFunctionRequest=SimpleNamespace,
            GetFunctionAddressRequest=SimpleNamespace,
            UpdateFunctionCodeRequest=SimpleNamespace,
        )
        modules = patch.dict(
            sys.modules,
            {
                "tencentcloud": SimpleNamespace(),
                "tencentcloud.scf": SimpleNamespace(),
                "tencentcloud.scf.v20180416": SimpleNamespace(models=models),
            },
        )
        modules.start()
        self.addCleanup(modules.stop)

    def test_replace_preserves_other_files_and_metadata(self):
        original = make_package()
        updated = deploy_scf.replace_bundle(original, b"new bundle")

        with (
            zipfile.ZipFile(io.BytesIO(original)) as before,
            zipfile.ZipFile(io.BytesIO(updated)) as after,
        ):
            self.assertEqual(before.namelist(), after.namelist())
            self.assertEqual(after.read("src/bundle.js"), b"new bundle")
            for name in ("src/app.js", "config.json"):
                self.assertEqual(before.read(name), after.read(name))
                self.assertEqual(
                    deploy_scf._zip_metadata(before.getinfo(name)),
                    deploy_scf._zip_metadata(after.getinfo(name)),
                )

    def test_app_is_replaced_together_with_bundle(self):
        original = make_package()
        updated = deploy_scf.replace_bundle(
            original, b"new bundle", b"new handler"
        )
        with zipfile.ZipFile(io.BytesIO(updated)) as archive:
            self.assertEqual(archive.read("src/app.js"), b"new handler")
            self.assertEqual(archive.read("src/bundle.js"), b"new bundle")
            # 其余文件原样保留
            self.assertEqual(archive.read("config.json"), b'{"keep": true}')

    def test_app_is_untouched_when_not_provided(self):
        original = make_package()
        updated = deploy_scf.replace_bundle(original, b"new bundle")
        with zipfile.ZipFile(io.BytesIO(updated)) as archive:
            self.assertEqual(archive.read("src/app.js"), b"handler")

    def test_empty_app_is_rejected(self):
        with self.assertRaises(deploy_scf.DeploymentError):
            deploy_scf.replace_bundle(make_package(), b"new bundle", b"")

    def test_missing_target_or_required_file_is_rejected(self):
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            archive.writestr("src/app.js", b"handler")
        with self.assertRaisesRegex(deploy_scf.DeploymentError, "bundle.js"):
            deploy_scf.replace_bundle(output.getvalue(), b"new")

        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            archive.writestr("src/bundle.js", b"old")
        with self.assertRaisesRegex(deploy_scf.DeploymentError, "app.js"):
            deploy_scf.replace_bundle(output.getvalue(), b"new")

    def test_empty_download_url_is_rejected(self):
        with self.assertRaisesRegex(deploy_scf.DeploymentError, "下载地址"):
            deploy_scf.download_package("")

    def test_console_root_layout_is_supported(self):
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            archive.writestr("app.js", b"handler")
            archive.writestr("bundle.js", b"old")
        updated = deploy_scf.replace_bundle(output.getvalue(), b"new")
        with zipfile.ZipFile(io.BytesIO(updated)) as archive:
            self.assertEqual(archive.read("app.js"), b"handler")
            self.assertEqual(archive.read("bundle.js"), b"new")

    def test_ambiguous_layout_is_rejected(self):
        output = io.BytesIO(make_package())
        with zipfile.ZipFile(output, "a") as archive:
            archive.writestr("app.js", b"handler")
            archive.writestr("bundle.js", b"old")
        with self.assertRaisesRegex(deploy_scf.DeploymentError, "唯一"):
            deploy_scf.replace_bundle(output.getvalue(), b"new")

    def test_download_error_does_not_expose_signed_url(self):
        url = "https://example.invalid/code?signature=secret"
        with self.assertRaises(deploy_scf.DeploymentError) as caught:
            deploy_scf.download_package(url, opener=Mock(side_effect=OSError(url)))
        self.assertNotIn("secret", str(caught.exception))

    def test_download_upgrades_http(self):
        opener = Mock(return_value=io.BytesIO(b"zip"))
        self.assertEqual(
            deploy_scf.download_package("http://example.invalid/code", opener), b"zip"
        )
        opener.assert_called_once_with("https://example.invalid/code", timeout=60)

    def test_duplicate_paths_and_invalid_zip_are_rejected(self):
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            output = io.BytesIO(make_package())
            with zipfile.ZipFile(output, "a") as archive:
                archive.writestr("src/bundle.js", b"duplicate")
        with self.assertRaisesRegex(deploy_scf.DeploymentError, "重复路径"):
            deploy_scf.replace_bundle(output.getvalue(), b"new")
        with self.assertRaisesRegex(deploy_scf.DeploymentError, "zip"):
            deploy_scf.replace_bundle(b"not a zip", b"new")
        with self.assertRaisesRegex(deploy_scf.DeploymentError, "为空"):
            deploy_scf.replace_bundle(make_package(), b"")

    def test_read_address_requests_latest_in_selected_namespace(self):
        client = FakeAddressClient(["https://example.invalid/package"])
        self.assertEqual(
            deploy_scf.get_function_address(client, "custom"),
            "https://example.invalid/package",
        )
        self.assertEqual(
            vars(client.requests[0]),
            {
                "FunctionName": "IIROSE-MEDIA-WEB",
                "Namespace": "custom",
                "Qualifier": "$LATEST",
            },
        )

    def test_wait_accepts_transition_to_active(self):
        client = FakeFunctionClient(
            [
                SimpleNamespace(Status="Updating"),
                SimpleNamespace(
                    Status="Active", AvailableStatus="Available", CodeResult="success"
                ),
            ]
        )
        deploy_scf.wait_for_function_ready(client, "default", sleep=lambda _: None)

    def test_wait_detects_rollback_failure_without_leaking_server_text(self):
        client = FakeFunctionClient(
            [SimpleNamespace(Status="UpdateFailedRollbackDone", StatusDesc="secret")]
        )
        with self.assertRaises(deploy_scf.DeploymentError) as caught:
            deploy_scf.wait_for_function_ready(client, "default")
        self.assertNotIn("secret", str(caught.exception))

    def test_cloud_error_does_not_expose_response(self):
        client = SimpleNamespace(
            GetFunctionAddress=Mock(side_effect=RuntimeError("secret signed URL"))
        )
        with self.assertRaisesRegex(
            deploy_scf.DeploymentError, "GetFunctionAddress"
        ) as caught:
            deploy_scf.get_function_address(client, "default")
        self.assertNotIn("secret", str(caught.exception))

    def test_deployment_downloads_updates_waits_and_verifies(self):
        events = []
        original = make_package()
        uploaded = []

        def address(request):
            events.append("address")
            return SimpleNamespace(Url="https://example.invalid/package")

        def update(request):
            events.append("update")
            uploaded.append(base64.b64decode(request.ZipFile))

        def status(request):
            events.append("status")
            self.assertEqual(request.Qualifier, "$LATEST")
            return SimpleNamespace(Status="Active")

        def download(url):
            events.append("download")
            return uploaded[0] if uploaded else original

        client = SimpleNamespace(
            GetFunctionAddress=address, UpdateFunctionCode=update, GetFunction=status
        )
        with patch.object(deploy_scf, "download_package", side_effect=download):
            deploy_scf.deploy_bundle(client, "default", b"new bundle")
        self.assertEqual(
            events, ["address", "download", "update", "status", "address", "download"]
        )
        with zipfile.ZipFile(io.BytesIO(uploaded[0])) as archive:
            self.assertEqual(archive.read("src/bundle.js"), b"new bundle")

    def test_deployment_rejects_corrupted_final_download(self):
        original = make_package()
        for changed_path, error in (
            ("src/bundle.js", "src/bundle.js 内容校验失败"),
            ("src/app.js", "其他文件内容发生变化"),
        ):
            with self.subTest(changed_path=changed_path):
                output = io.BytesIO()
                with (
                    zipfile.ZipFile(io.BytesIO(original)) as before,
                    zipfile.ZipFile(output, "w") as after,
                ):
                    after.comment = before.comment
                    for entry in before.infolist():
                        data = (
                            b"new bundle"
                            if entry.filename == "src/bundle.js"
                            else before.read(entry)
                        )
                        if entry.filename == changed_path:
                            data = b"corrupted content"
                        after.writestr(copy.copy(entry), data)

                client = SimpleNamespace(
                    GetFunctionAddress=Mock(
                        return_value=SimpleNamespace(
                            Url="https://example.invalid/package"
                        )
                    ),
                    UpdateFunctionCode=Mock(),
                    GetFunction=Mock(return_value=SimpleNamespace(Status="Active")),
                )
                with patch.object(
                    deploy_scf,
                    "download_package",
                    side_effect=[original, output.getvalue()],
                ) as download:
                    with self.assertRaisesRegex(deploy_scf.DeploymentError, error):
                        deploy_scf.deploy_bundle(client, "default", b"new bundle")
                client.UpdateFunctionCode.assert_called_once()
                client.GetFunction.assert_called_once()
                self.assertEqual(download.call_count, 2)

    def test_update_failure_stops_before_polling_and_verification(self):
        client = SimpleNamespace(
            GetFunctionAddress=Mock(
                return_value=SimpleNamespace(Url="https://example.invalid/package")
            ),
            UpdateFunctionCode=Mock(side_effect=RuntimeError("secret")),
            GetFunction=Mock(),
        )
        with patch.object(deploy_scf, "download_package", return_value=make_package()):
            with self.assertRaisesRegex(
                deploy_scf.DeploymentError, "UpdateFunctionCode"
            ):
                deploy_scf.deploy_bundle(client, "default", b"new")
        client.GetFunction.assert_not_called()
        client.GetFunctionAddress.assert_called_once()

    def test_post_update_other_file_and_metadata_changes_fail(self):
        original = make_package()
        for change in ("content", "metadata", "comment", "list"):
            with self.subTest(change=change):
                output = io.BytesIO()
                with (
                    zipfile.ZipFile(io.BytesIO(original)) as before,
                    zipfile.ZipFile(output, "w") as after,
                ):
                    after.comment = (
                        b"changed" if change == "comment" else before.comment
                    )
                    for entry in before.infolist():
                        info = copy.copy(entry)
                        data = (
                            b"new"
                            if info.filename == "src/bundle.js"
                            else before.read(entry)
                        )
                        if info.filename == "src/app.js":
                            if change == "content":
                                data = b"changed handler"
                            if change == "metadata":
                                info.comment = b"changed"
                            if change == "list":
                                continue
                        after.writestr(info, data)
                with self.assertRaises(deploy_scf.DeploymentError):
                    deploy_scf.verify_package_update(
                        original, output.getvalue(), b"new"
                    )

    def test_main_missing_credentials_fails_without_traceback(self):
        output = io.StringIO()
        with patch.dict(deploy_scf.os.environ, {}, clear=True), redirect_stderr(output):
            result = deploy_scf.main(["--bundle", "unused.js"])
        self.assertEqual(result, 1)
        self.assertIn("缺少", output.getvalue())
        self.assertNotIn("Traceback", output.getvalue())

    def test_main_unexpected_error_is_sanitized(self):
        output = io.StringIO()
        with (
            patch.object(deploy_scf, "deploy", side_effect=RuntimeError("secret")),
            redirect_stderr(output),
        ):
            result = deploy_scf.main(["--bundle", "unused.js"])
        self.assertEqual(result, 1)
        self.assertNotIn("secret", output.getvalue())

    def test_wait_reports_failed_status(self):
        client = FakeFunctionClient(
            [SimpleNamespace(Status="Failed", StatusDesc="bad code")]
        )
        with patch.dict(sys.modules, {"tencentcloud": SimpleNamespace()}):
            with self.assertRaisesRegex(deploy_scf.DeploymentError, "更新失败"):
                deploy_scf.wait_for_function_ready(client, "default")

    def test_wait_reports_timeout(self):
        client = FakeFunctionClient(
            [SimpleNamespace(Status="Updating", AvailableStatus="Unavailable")] * 2
        )
        clock = iter([0.0, 0.0, 2.0])
        with patch.dict(sys.modules, {"tencentcloud": SimpleNamespace()}):
            with self.assertRaisesRegex(deploy_scf.DeploymentError, "超时"):
                deploy_scf.wait_for_function_ready(
                    client,
                    "default",
                    timeout=1,
                    interval=0,
                    sleep=lambda _: None,
                    monotonic=lambda: next(clock),
                )

    def test_update_request_uses_latest_zip_without_publishing(self):
        request_module = SimpleNamespace(
            UpdateFunctionCodeRequest=lambda: SimpleNamespace(),
        )
        scf_module = SimpleNamespace(models=request_module)
        with patch.dict(
            sys.modules,
            {
                "tencentcloud": SimpleNamespace(),
                "tencentcloud.scf": SimpleNamespace(),
                "tencentcloud.scf.v20180416": scf_module,
            },
        ):
            client = SimpleNamespace(UpdateFunctionCode=lambda request: request)
            request = deploy_scf.update_function_code(client, "default", b"zip")
        self.assertEqual(request.FunctionName, deploy_scf.FUNCTION_NAME)
        self.assertFalse(hasattr(request, "Qualifier"))
        self.assertFalse(hasattr(request, "Handler"))
        self.assertEqual(request.Publish, "FALSE")
        self.assertEqual(request.CodeSource, "ZipFile")
        self.assertEqual(base64.b64decode(request.ZipFile), b"zip")

    def test_post_update_verification_detects_unexpected_change(self):
        original = make_package()
        changed = make_package()
        changed = deploy_scf.replace_bundle(changed, b"new bundle")
        deploy_scf.verify_package_update(original, changed, b"new bundle")
        with self.assertRaisesRegex(deploy_scf.DeploymentError, "bundle.js"):
            deploy_scf.verify_package_update(original, changed, b"wrong")


if __name__ == "__main__":
    unittest.main()
