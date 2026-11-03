#!/usr/bin/env python3
"""Replace the frontend bundle in an existing Tencent Cloud SCF zip package."""

from __future__ import annotations

import argparse
import base64
import copy
import io
import os
import sys
import time
import urllib.request
import zipfile
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Any


REGION = "ap-guangzhou"
FUNCTION_NAME = "IIROSE-MEDIA-WEB"
DEFAULT_NAMESPACE = "default"
QUALIFIER = "$LATEST"
TARGET_BUNDLE = "src/bundle.js"
REQUIRED_ENTRY = "src/app.js"
# 云函数的前端入口：随仓库维护（gzip 响应），部署时与 bundle 一起替换。
APP_SOURCE = Path(__file__).resolve().parent.parent / "cloud" / "bundle" / "app.js"
DEFAULT_TIMEOUT_SECONDS = 600
DEFAULT_POLL_INTERVAL_SECONDS = 5


class DeploymentError(RuntimeError):
    """Raised when a deployment cannot be completed or verified."""


def _zip_metadata(info: zipfile.ZipInfo) -> tuple[Any, ...]:
    """Return metadata that must survive rebuilding the package."""

    return (
        info.date_time,
        info.compress_type,
        info.comment,
        info.extra,
        info.create_system,
        info.create_version,
        info.extract_version,
        info.flag_bits,
        info.internal_attr,
        info.external_attr,
        info.volume,
    )


def _read_zip(data: bytes) -> zipfile.ZipFile:
    try:
        archive = zipfile.ZipFile(io.BytesIO(data), "r")
        if archive.testzip() is not None:
            archive.close()
            raise DeploymentError("代码包 CRC 完整性校验失败")
        return archive
    except (OSError, zipfile.BadZipFile) as exc:
        raise DeploymentError("腾讯云函数现有代码包不是有效的 zip 文件") from exc


def replace_bundle(
    package: bytes, bundle: bytes, app: bytes | None = None
) -> bytes:
    """Replace ``bundle.js``（以及可选的 ``app.js``）while retaining all other entries."""

    with _read_zip(package) as source:
        names = source.namelist()
        if len(set(names)) != len(names):
            raise DeploymentError("现有代码包含重复路径，无法安全替换")
        target = bundle_entry(names)
        app_target = target[: -len("bundle.js")] + "app.js"
        if not bundle:
            raise DeploymentError("构建后的 bundle 为空")
        if app is not None and not app:
            raise DeploymentError("app.js 为空，拒绝用空文件覆盖线上入口")

        replacements = {target: bundle}
        if app is not None:
            replacements[app_target] = app

        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as destination:
            destination.comment = source.comment
            for info in source.infolist():
                content = replacements.get(info.filename, source.read(info))
                destination.writestr(
                    copy.copy(info), content, compress_type=info.compress_type
                )
        updated = output.getvalue()
    # 上传前也验证；不能保留元数据的特殊 zip 必须在修改云函数前失败。
    verify_package_update(package, updated, bundle, app)
    return updated


def bundle_entry(names: list[str]) -> str:
    # SCF 控制台的 src 可能仅表示编辑器根目录，不一定是 zip 内的目录。
    candidates = [
        prefix + "bundle.js"
        for prefix in ("src/", "")
        if prefix + "bundle.js" in names and prefix + "app.js" in names
    ]
    if len(candidates) != 1:
        raise DeploymentError(
            "代码包须在 src/ 或根目录唯一包含配对的 app.js 与 bundle.js"
        )
    return candidates[0]


def verify_package_update(
    original: bytes,
    updated: bytes,
    expected_bundle: bytes,
    expected_app: bytes | None = None,
) -> None:
    """Verify the replacement and preservation invariants after re-downloading."""

    with _read_zip(original) as before, _read_zip(updated) as after:
        target = bundle_entry(before.namelist())
        if before.comment != after.comment:
            raise DeploymentError("更新后代码包注释发生变化")
        if before.namelist() != after.namelist():
            raise DeploymentError("更新后代码包的文件列表发生了非预期变化")

        for before_info, after_info in zip(before.infolist(), after.infolist()):
            if before_info.filename != after_info.filename:
                raise DeploymentError("更新后代码包的文件顺序发生了非预期变化")
            if _zip_metadata(before_info) != _zip_metadata(after_info):
                raise DeploymentError("更新后文件元数据发生变化")
            expected = None
            if before_info.filename == target:
                expected = expected_bundle
            elif expected_app is not None and before_info.filename == (
                target[: -len("bundle.js")] + "app.js"
            ):
                expected = expected_app
            if expected is not None:
                if after.read(after_info) != expected:
                    raise DeploymentError(f"更新后 {before_info.filename} 内容校验失败")
            elif before.read(before_info) != after.read(after_info):
                raise DeploymentError("更新后其他文件内容发生变化")

        bundle_entry(after.namelist())


def _field(response: Any, name: str, default: Any = None) -> Any:
    if isinstance(response, Mapping):
        return response.get(name, default)
    return getattr(response, name, default)


def _response(response: Any) -> Any:
    return _field(response, "Response", response)


def download_package(
    url: str, opener: Callable[..., Any] = urllib.request.urlopen
) -> bytes:
    if not url:
        raise DeploymentError("GetFunctionAddress 未返回代码包下载地址")
    if url.startswith("http://"):
        url = "https://" + url[len("http://") :]
    if not url.startswith("https://"):
        raise DeploymentError("代码包下载地址必须使用 HTTPS")
    try:
        with opener(url, timeout=60) as response:
            return response.read()
    except (OSError, ValueError) as exc:
        raise DeploymentError("下载腾讯云函数现有代码包失败") from exc


def call_api(client: Any, action: str, request: Any) -> Any:
    try:
        return getattr(client, action)(request)
    except Exception:
        # SDK 异常可能包含请求体、签名 URL 或服务端文本，禁止原样输出。
        raise DeploymentError(
            f"{action} 调用失败，请检查凭据、目标函数与 API 权限"
        ) from None


def get_function_address(
    client: Any, namespace: str, name: str = FUNCTION_NAME
) -> str:
    from tencentcloud.scf.v20180416 import models

    request = models.GetFunctionAddressRequest()
    request.FunctionName = name
    request.Namespace = namespace
    request.Qualifier = QUALIFIER
    response = _response(call_api(client, "GetFunctionAddress", request))
    return str(_field(response, "Url", "") or "")


def update_function_code(
    client: Any, namespace: str, package: bytes, name: str = FUNCTION_NAME
) -> Any:
    from tencentcloud.scf.v20180416 import models

    request = models.UpdateFunctionCodeRequest()
    request.FunctionName = name
    request.Namespace = namespace
    request.ZipFile = base64.b64encode(package).decode("ascii")
    if len(request.ZipFile) > 20 * 1024 * 1024:
        raise DeploymentError("代码包超过 UpdateFunctionCode ZipFile 的 20 MiB 限制")
    request.Publish = "FALSE"
    request.CodeSource = "ZipFile"
    # UpdateFunctionCode 只更新 $LATEST；该 API 没有 Qualifier 参数。
    return call_api(client, "UpdateFunctionCode", request)


def wait_for_function_ready(
    client: Any,
    namespace: str,
    name: str = FUNCTION_NAME,
    *,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
    interval: float = DEFAULT_POLL_INTERVAL_SECONDS,
    sleep: Callable[[float], None] = time.sleep,
    monotonic: Callable[[], float] = time.monotonic,
) -> None:
    """Wait for the asynchronous code update and fail clearly on bad states."""

    from tencentcloud.scf.v20180416 import models

    started = monotonic()
    while True:
        request = models.GetFunctionRequest()
        request.FunctionName = name
        request.Namespace = namespace
        request.Qualifier = QUALIFIER
        request.ShowCode = "FALSE"
        response = _response(call_api(client, "GetFunction", request))
        status = str(_field(response, "Status", "") or "")
        available = str(_field(response, "AvailableStatus", "") or "")
        code_result = str(_field(response, "CodeResult", "") or "")
        if (
            "fail" in status.lower()
            or status in {"Error", "Inactive"}
            or _field(response, "ErrNo", 0)
            or code_result.lower()
            in {
                "fail",
                "failed",
                "error",
            }
        ):
            raise DeploymentError("腾讯云函数更新失败，请在 SCF 控制台查看函数状态")
        if (
            status == "Active"
            and available in {"", "Available"}
            and code_result.lower() in {"", "success"}
        ):
            return
        if monotonic() - started >= timeout:
            raise DeploymentError(f"等待腾讯云函数更新超时（{timeout:.0f}s）")
        sleep(interval)


def deploy_bundle(
    client: Any, namespace: str, bundle: bytes, app: bytes | None = None
) -> None:
    address = get_function_address(client, namespace)
    original = download_package(address)
    updated = replace_bundle(original, bundle, app)
    update_function_code(client, namespace, updated)
    wait_for_function_ready(client, namespace)
    verified = download_package(get_function_address(client, namespace))
    verify_package_update(original, verified, bundle, app)


def deploy(bundle_path: Path, secret_id: str, secret_key: str, namespace: str) -> None:
    if not secret_id or not secret_key:
        raise DeploymentError("缺少 TENCENT_SECRET_ID 或 TENCENT_SECRET_KEY")
    bundle = bundle_path.read_bytes()
    # 云函数入口随仓库维护：读完即校验，空文件在替换阶段会被拒绝。
    app = APP_SOURCE.read_bytes() if APP_SOURCE.is_file() else None

    from tencentcloud.common import credential
    from tencentcloud.common.profile.client_profile import ClientProfile
    from tencentcloud.common.profile.http_profile import HttpProfile
    from tencentcloud.scf.v20180416 import scf_client

    profile = ClientProfile(httpProfile=HttpProfile(reqTimeout=60))
    client = scf_client.ScfClient(
        credential.Credential(secret_id, secret_key), REGION, profile
    )
    deploy_bundle(client, namespace, bundle, app)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--bundle", type=Path, required=True, help="构建后的 dist/bundle.js 路径"
    )
    args = parser.parse_args(argv)
    namespace = os.environ.get("SCF_NAMESPACE") or DEFAULT_NAMESPACE
    try:
        deploy(
            args.bundle,
            os.environ.get("TENCENT_SECRET_ID", ""),
            os.environ.get("TENCENT_SECRET_KEY", ""),
            namespace,
        )
    except DeploymentError as exc:
        print(f"部署失败: {exc}", file=sys.stderr)
        return 1
    except Exception:
        print(
            "部署失败: 无法读取构建文件、加载 SDK 或处理代码包；未输出敏感异常详情",
            file=sys.stderr,
        )
        return 1
    print(
        f"已更新 {REGION} / {namespace} / {FUNCTION_NAME} 的 bundle.js 并完成回读校验"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
