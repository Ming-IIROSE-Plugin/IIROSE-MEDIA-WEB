#!/usr/bin/env python3
"""Rebuild a Tencent Cloud SCF package from a local directory and deploy it.

与 ``deploy_function_app.py`` 的区别：那个只替换包内 ``app.js``（保留线上其余文件，
适合 ``node_modules`` 必须留着的情况）；这里用本地目录**整包替换**，适合把历史包袱
（不再使用的 express / jade 等）从代码包里清掉——包越小，冷启动越快。

打包规则：
- 目录下的所有文件，路径相对目录根。
- 可执行位原样进 zip（``scf_bootstrap`` 必须可执行）。
- 时间戳固定，同样的源码打出同样的包（便于比对）。
"""

from __future__ import annotations

import argparse
import io
import os
import sys
import zipfile
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent))
from deploy_scf import (  # noqa: E402
    DEFAULT_NAMESPACE,
    DeploymentError,
    _read_zip,
    call_api,
    download_package,
    get_function_address,
    update_function_code,
    wait_for_function_ready,
)

REGION = "ap-guangzhou"
FIXED_TIMESTAMP = (2026, 1, 1, 0, 0, 0)


def build_package(directory: Path) -> bytes:
    """Zip every file under ``directory``, keeping the executable bit."""

    if not directory.is_dir():
        raise DeploymentError(f"目录不存在：{directory}")
    files = sorted(p for p in directory.rglob("*") if p.is_file())
    if not files:
        raise DeploymentError("目录为空，拒绝部署")

    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            rel = path.relative_to(directory).as_posix()
            info = zipfile.ZipInfo(rel, date_time=FIXED_TIMESTAMP)
            mode = 0o755 if os.access(path, os.X_OK) else 0o644
            info.external_attr = (0o100000 | mode) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, path.read_bytes())
    return output.getvalue()


def verify_package(directory: Path, package: bytes) -> None:
    """Compare the deployed package against the local directory, file by file."""

    expected = {
        p.relative_to(directory).as_posix(): p.read_bytes()
        for p in sorted(directory.rglob("*"))
        if p.is_file()
    }
    with _read_zip(package) as archive:
        names = archive.namelist()
        if set(names) != set(expected):
            missing = sorted(set(expected) - set(names))
            extra = sorted(set(names) - set(expected))
            raise DeploymentError(f"代码包文件列表不一致：缺 {missing}，多 {extra}")
        for name, content in expected.items():
            if archive.read(name) != content:
                raise DeploymentError(f"代码包内 {name} 内容校验失败")


def deploy(client: Any, namespace: str, name: str, directory: Path) -> int:
    package = build_package(directory)
    update_function_code(client, namespace, package, name)
    wait_for_function_ready(client, namespace, name)
    deployed = download_package(get_function_address(client, namespace, name))
    verify_package(directory, deployed)
    return len(package)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", required=True, help="云函数名，例如 Cors-Anywhere")
    parser.add_argument("--region", default=REGION, help="地域，例如 ap-hongkong")
    parser.add_argument(
        "--dir",
        type=Path,
        required=True,
        help="本地包目录，例如 cloud/cors-anywhere",
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
        size = deploy(client, namespace, args.name, args.dir)
    except DeploymentError as exc:
        print(f"部署失败：{exc}", file=sys.stderr)
        return 1
    print(
        f"已用 {args.dir} 整包更新 {args.region} / {namespace} / {args.name}"
        f"（{size} 字节）并完成回读校验"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
