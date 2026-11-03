#!/usr/bin/env python3
"""Replace the ``app.js`` entry of an existing Tencent Cloud SCF package.

与 ``deploy_scf.py`` 的区别：那个只服务前端 bundle（要求 ``app.js`` 与
``bundle.js`` 配对）；这里用于「纯 HTTP 转发」这类只有 ``app.js`` 的函数
（如 Cors-Anywhere / MusicAPI），只替换入口文件，其余文件原样保留。
"""

from __future__ import annotations

import argparse
import copy
import io
import os
import sys
import zipfile
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent))
from deploy_scf import (  # noqa: E402
    DeploymentError,
    DEFAULT_NAMESPACE,
    _read_zip,
    _zip_metadata,
    call_api,
    download_package,
    get_function_address,
    update_function_code,
    wait_for_function_ready,
)

REGION = "ap-guangzhou"
APP_NAME = "app.js"


def app_entry(names: list[str]) -> str:
    """包内 ``app.js`` 的路径：根目录或 ``src/``，必须唯一。"""

    candidates = [name for name in (APP_NAME, f"src/{APP_NAME}") if name in names]
    if len(candidates) != 1:
        raise DeploymentError("代码包须在 src/ 或根目录唯一包含 app.js")
    return candidates[0]


def replace_app(package: bytes, app: bytes) -> bytes:
    """Replace exactly the package's ``app.js`` while retaining all other entries."""

    if not app:
        raise DeploymentError("app.js 为空，拒绝用空文件覆盖线上入口")

    with _read_zip(package) as source:
        names = source.namelist()
        if len(set(names)) != len(names):
            raise DeploymentError("现有代码包含重复路径，无法安全替换")
        target = app_entry(names)

        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as destination:
            destination.comment = source.comment
            for info in source.infolist():
                content = app if info.filename == target else source.read(info)
                destination.writestr(
                    copy.copy(info),
                    content,
                    compress_type=info.compress_type,
                )
        updated = output.getvalue()
    verify_app_update(package, updated, app)
    return updated


def verify_app_update(original: bytes, updated: bytes, expected_app: bytes) -> None:
    """Verify the replacement and preservation invariants after re-downloading."""

    with _read_zip(original) as before, _read_zip(updated) as after:
        target = app_entry(before.namelist())
        if before.comment != after.comment:
            raise DeploymentError("更新后代码包注释发生变化")
        if before.namelist() != after.namelist():
            raise DeploymentError("更新后代码包的文件列表发生了非预期变化")

        for before_info, after_info in zip(before.infolist(), after.infolist()):
            if before_info.filename != after_info.filename:
                raise DeploymentError("更新后代码包的文件顺序发生了非预期变化")
            if _zip_metadata(before_info) != _zip_metadata(after_info):
                raise DeploymentError("更新后文件元数据发生变化")
            if before_info.filename == target:
                if after.read(after_info) != expected_app:
                    raise DeploymentError(f"更新后 {target} 内容校验失败")
            elif before.read(before_info) != after.read(after_info):
                raise DeploymentError("更新后其他文件内容发生变化")

        app_entry(after.namelist())


def deploy(client: Any, namespace: str, name: str, app: bytes) -> None:
    address = get_function_address(client, namespace, name)
    original = download_package(address)
    updated = replace_app(original, app)
    update_function_code(client, namespace, updated, name)
    wait_for_function_ready(client, namespace, name)
    verified = download_package(get_function_address(client, namespace, name))
    verify_app_update(original, verified, app)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", required=True, help="云函数名，例如 Cors-Anywhere")
    parser.add_argument("--region", default=REGION, help="地域，例如 ap-hongkong")
    parser.add_argument(
        "--app",
        type=Path,
        required=True,
        help="本地 app.js 路径，例如 cloud/cors-anywhere/app.js",
    )
    args = parser.parse_args(argv)

    secret_id = os.environ.get("TENCENT_SECRET_ID") or ""
    secret_key = os.environ.get("TENCENT_SECRET_KEY") or ""
    if not secret_id or not secret_key:
        print("缺少 TENCENT_SECRET_ID 或 TENCENT_SECRET_KEY", file=sys.stderr)
        return 2

    namespace = os.environ.get("SCF_NAMESPACE") or DEFAULT_NAMESPACE
    try:
        from tencentcloud.common import credential
        from tencentcloud.common.profile.client_profile import ClientProfile
        from tencentcloud.common.profile.http_profile import HttpProfile
        from tencentcloud.scf.v20180416 import scf_client

        profile = ClientProfile(httpProfile=HttpProfile(reqTimeout=60))
        client = scf_client.ScfClient(
            credential.Credential(secret_id, secret_key), args.region, profile
        )
        deploy(client, namespace, args.name, args.app.read_bytes())
    except DeploymentError as exc:
        print(f"部署失败：{exc}", file=sys.stderr)
        return 1
    print(f"已更新 {args.region} / {namespace} / {args.name} 的 app.js 并完成回读校验")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
