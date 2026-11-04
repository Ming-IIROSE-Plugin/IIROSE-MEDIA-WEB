#!/usr/bin/env python3
"""Create or update the IIROSE-MEDIA-SYNC function URL backend.

幂等 upsert：函数不存在则创建（固定角色、内存/超时、桶与地域环境变量），存在则先收敛
角色/环境变量/内存与超时、再更新代码；随后确保函数 URL（开放鉴权，地址读不到即失败）
并下发函数最大独占配额。函数 URL 会回读校验，配额不参与回读。不输出任何凭据、签名串
或云返回文本。
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Any

REGION = "ap-guangzhou"
FUNCTION_NAME = "IIROSE-MEDIA-SYNC"
DEFAULT_NAMESPACE = "default"
QUALIFIER = "$LATEST"
# 只读 sync/ 前缀的最小权限角色，见 backend-architecture.md 第 2 节。
ROLE_NAME = "IIROSE-MEDIA-SYNC-Role"
# 与同账号既有函数一致的受支持运行时；Node 18/20 均已 EOL，不选。
RUNTIME = "Nodejs24.11"
HANDLER = "index.main_handler"
MEMORY_MB = 128
TIMEOUT_SECONDS = 30
# 闸二：函数最大独占配额 = 预期最大并发 × 单实例内存（10 × 128MB）。
MAX_CONCURRENCY = 10
RESERVED_CONCURRENCY_MEM = MEMORY_MB * MAX_CONCURRENCY
# 与函数同地域的私有桶，桶名含 APPID。
COS_BUCKET = "iirose-media-sync-1309510434"
COS_REGION = "ap-guangzhou"
# 函数 URL 与触发器同级存在：Type=http 的触发器即「函数 URL」。
URL_TRIGGER_NAME = "func_url"
URL_TRIGGER_TYPE = "http"
URL_AUTH_TYPE = "NONE"
URL_TRIGGER_DESC = {
    "AuthType": URL_AUTH_TYPE,
    "NetConfig": {"EnableIntranet": True, "EnableExtranet": True},
}
# 触发器创建/更新是异步的：紧接着的 list_triggers 可能还读不到它（或读不到地址）。
URL_TRIGGER_ATTEMPTS = 5
URL_TRIGGER_DELAY_SECONDS = 1.0
SOURCE_DIR = Path(__file__).resolve().parent.parent / "cloud" / "sync"
# 客户端硬编码的函数 URL 所在地；部署后必须与真实地址一致，否则全体客户端会打旧地址
CLIENT_SETTINGS_PATH = (
    Path(__file__).resolve().parent.parent
    / "src"
    / "settings"
    / "pluginSettings"
    / "normalize.ts"
)
# 进包的文件：入口、依赖与模块类型声明；测试与仓库其余内容不入包。
PACKAGE_ENTRIES = ("package.json", "cos.js", "logic.js", "index.js")
# base64 后约 20 MiB，即 UpdateFunctionCode ZipFile 的上限。
MAX_PACKAGE_BYTES = 15 * 1024 * 1024
DEFAULT_TIMEOUT_SECONDS = 600
DEFAULT_POLL_INTERVAL_SECONDS = 5
# 固定时间戳，让同一份源码每次构建出同样的字节。
FIXED_ZIP_TIME = (1980, 1, 1, 0, 0, 0)


class DeploymentError(RuntimeError):
    """Raised when a deployment cannot be completed or verified."""


def build_package(source_dir: Path = SOURCE_DIR) -> bytes:
    """把 cloud/sync 的运行时文件打成扁平的 zip（可重复构建出同一份字节）。"""

    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for name in PACKAGE_ENTRIES:
            path = source_dir / name
            if not path.is_file():
                raise DeploymentError(f"缺少函数源码 {name}")
            content = path.read_bytes()
            if not content:
                raise DeploymentError(f"函数源码 {name} 为空")
            info = zipfile.ZipInfo(name, date_time=FIXED_ZIP_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, content)
    package = output.getvalue()
    if len(package) > MAX_PACKAGE_BYTES:
        raise DeploymentError("函数代码包过大，无法通过 UpdateFunctionCode 上传")
    verify_package_loads(package)
    return package


def verify_package_loads(package: bytes) -> None:
    """把包解到临时目录并用 Node 真加载一次入口。

    清单自证（namelist == PACKAGE_ENTRIES）挡不住「清单少了一个 require 目标」——
    那样打包与测试都全绿，线上却在每次调用时模块加载失败。这里以运行时行为为准：
    `require('./index.js')` 成功才算产物可上线。
    """

    node = shutil.which("node")
    if node is None:
        raise DeploymentError("校验函数代码包失败：找不到 node")
    with tempfile.TemporaryDirectory(prefix="iirose-sync-pkg-") as workdir:
        with zipfile.ZipFile(io.BytesIO(package)) as archive:
            archive.extractall(workdir)
        try:
            result = subprocess.run(
                [node, "-e", "require('./index.js')"],
                cwd=workdir,
                capture_output=True,
                text=True,
                timeout=60,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise DeploymentError("校验函数代码包失败：加载入口超时") from exc
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "").strip().splitlines()
            tail = detail[-1] if detail else f"退出码 {result.returncode}"
            raise DeploymentError(f"校验函数代码包失败：{tail}")


def _field(response: Any, name: str, default: Any = None) -> Any:
    if isinstance(response, Mapping):
        return response.get(name, default)
    return getattr(response, name, default)


def _response(response: Any) -> Any:
    return _field(response, "Response", response)


def _error_code(exc: BaseException) -> str:
    code = getattr(exc, "code", "") or ""
    if not code and hasattr(exc, "get_code"):
        try:
            code = exc.get_code() or ""
        except Exception:
            code = ""
    return str(code)


def call_api(
    client: Any, action: str, request: Any, *, missing_codes: tuple[str, ...] = ()
) -> Any:
    """调用 SCF API；命中 missing_codes 前缀的异常码视为「资源不存在」并返回 None。"""

    try:
        return getattr(client, action)(request)
    except Exception as exc:
        code = _error_code(exc)
        if code and any(code.startswith(prefix) for prefix in missing_codes):
            return None
        # SDK 异常可能包含请求体、签名 URL 或凭据，禁止原样输出。
        raise DeploymentError(
            f"{action} 调用失败，请检查凭据、目标函数与 API 权限"
        ) from None


def function_exists(client: Any, namespace: str) -> bool:
    from tencentcloud.scf.v20180416 import models

    request = models.GetFunctionRequest()
    request.FunctionName = FUNCTION_NAME
    request.Namespace = namespace
    request.Qualifier = QUALIFIER
    request.ShowCode = "FALSE"
    response = call_api(
        client,
        "GetFunction",
        request,
        missing_codes=("ResourceNotFound", "InvalidParameterValue.FunctionName"),
    )
    return response is not None


def build_code(models: Any, package: bytes) -> Any:
    code = models.Code()
    code.ZipFile = base64.b64encode(package).decode("ascii")
    return code


def build_environment(models: Any) -> Any:
    environment = models.Environment()
    variables = []
    for key, value in (("COS_BUCKET", COS_BUCKET), ("COS_REGION", COS_REGION)):
        variable = models.Variable()
        variable.Key = key
        variable.Value = value
        variables.append(variable)
    environment.Variables = variables
    return environment


def create_function(client: Any, namespace: str, package: bytes) -> None:
    from tencentcloud.scf.v20180416 import models

    request = models.CreateFunctionRequest()
    request.FunctionName = FUNCTION_NAME
    request.Namespace = namespace
    request.Runtime = RUNTIME
    request.Handler = HANDLER
    request.Role = ROLE_NAME
    request.MemorySize = MEMORY_MB
    request.Timeout = TIMEOUT_SECONDS
    request.Description = "收藏云同步后端（函数 URL，开放鉴权）"
    request.CodeSource = "ZipFile"
    request.Code = build_code(models, package)
    request.Environment = build_environment(models)
    call_api(client, "CreateFunction", request)


def update_function_code(client: Any, namespace: str, package: bytes) -> None:
    from tencentcloud.scf.v20180416 import models

    request = models.UpdateFunctionCodeRequest()
    request.FunctionName = FUNCTION_NAME
    request.Namespace = namespace
    request.ZipFile = base64.b64encode(package).decode("ascii")
    if len(request.ZipFile) > 20 * 1024 * 1024:
        raise DeploymentError("代码包超过 UpdateFunctionCode ZipFile 的 20 MiB 限制")
    request.Publish = "FALSE"
    request.CodeSource = "ZipFile"
    # UpdateFunctionCode 只更新 $LATEST；该 API 没有 Qualifier 参数。
    call_api(client, "UpdateFunctionCode", request)


def update_function_configuration(client: Any, namespace: str) -> None:
    """已存在的函数也要收敛角色、环境变量与超时/内存：只替换代码不会纠正它们。"""

    from tencentcloud.scf.v20180416 import models

    request = models.UpdateFunctionConfigurationRequest()
    request.FunctionName = FUNCTION_NAME
    request.Namespace = namespace
    request.Role = ROLE_NAME
    request.MemorySize = MEMORY_MB
    request.Timeout = TIMEOUT_SECONDS
    request.Environment = build_environment(models)
    call_api(client, "UpdateFunctionConfiguration", request)


def wait_for_function_ready(
    client: Any,
    namespace: str,
    *,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
    interval: float = DEFAULT_POLL_INTERVAL_SECONDS,
    sleep: Callable[[float], None] = time.sleep,
    monotonic: Callable[[], float] = time.monotonic,
) -> None:
    """等待异步的创建/代码更新落地，失败状态必须显式中止。"""

    from tencentcloud.scf.v20180416 import models

    started = monotonic()
    while True:
        request = models.GetFunctionRequest()
        request.FunctionName = FUNCTION_NAME
        request.Namespace = namespace
        request.Qualifier = QUALIFIER
        request.ShowCode = "FALSE"
        # 创建/更新刚发起时 GetFunction 可能还报「函数不存在」，这属于「尚未就绪」。
        response = call_api(
            client,
            "GetFunction",
            request,
            missing_codes=("ResourceNotFound",),
        )
        if response is not None:
            response = _response(response)
            status = str(_field(response, "Status", "") or "")
            available = str(_field(response, "AvailableStatus", "") or "")
            code_result = str(_field(response, "CodeResult", "") or "")
            if (
                "fail" in status.lower()
                or status in {"Error", "Inactive"}
                or _field(response, "ErrNo", 0)
                or code_result.lower() in {"fail", "failed", "error"}
            ):
                raise DeploymentError("函数更新失败，请在 SCF 控制台查看函数状态")
            if (
                status == "Active"
                and available in {"", "Available"}
                and code_result.lower() in {"", "success"}
            ):
                return
        if monotonic() - started >= timeout:
            raise DeploymentError(f"等待函数更新超时（{timeout:.0f}s）")
        sleep(interval)


def list_triggers(client: Any, namespace: str) -> list[Any]:
    from tencentcloud.scf.v20180416 import models

    request = models.ListTriggersRequest()
    request.FunctionName = FUNCTION_NAME
    request.Namespace = namespace
    response = _response(call_api(client, "ListTriggers", request))
    return list(_field(response, "Triggers", []) or [])


def trigger_desc(trigger: Any) -> Mapping[str, Any]:
    raw = _field(trigger, "TriggerDesc", "")
    if isinstance(raw, Mapping):
        return raw
    if not isinstance(raw, str) or not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except ValueError:
        return {}
    return parsed if isinstance(parsed, Mapping) else {}


def trigger_auth_type(trigger: Any) -> str:
    value = trigger_desc(trigger).get("AuthType", "")
    return str(value or "")


def trigger_url(trigger: Any) -> str:
    """函数 URL 的公网地址在 TriggerDesc.NetConfig.ExtranetUrl（实测确认的路径）。"""

    desc = trigger_desc(trigger)
    net_config = desc.get("NetConfig")
    if isinstance(net_config, Mapping):
        value = net_config.get("ExtranetUrl")
        if isinstance(value, str) and value:
            return value
    for key in ("Url", "URL", "url"):
        value = desc.get(key)
        if isinstance(value, str) and value:
            return value
    return ""


def find_url_trigger(triggers: list[Any]) -> Any:
    for trigger in triggers:
        if str(_field(trigger, "Type", "") or "") == URL_TRIGGER_TYPE:
            return trigger
    return None


def wait_for_url_trigger(
    client: Any,
    namespace: str,
    *,
    attempts: int = URL_TRIGGER_ATTEMPTS,
    delay: float = URL_TRIGGER_DELAY_SECONDS,
    sleep: Callable[[float], None] = time.sleep,
) -> Any:
    """等函数 URL 触发器出现并带上地址；地址读不到也继续重试（描述可能滞后）。"""

    trigger = None
    for attempt in range(attempts):
        trigger = find_url_trigger(list_triggers(client, namespace))
        if trigger is not None and trigger_url(trigger):
            return trigger
        if attempt + 1 < attempts:
            sleep(delay)
    return trigger


def create_function_url(client: Any, namespace: str) -> None:
    from tencentcloud.scf.v20180416 import models

    request = models.CreateTriggerRequest()
    request.FunctionName = FUNCTION_NAME
    request.TriggerName = URL_TRIGGER_NAME
    request.Type = URL_TRIGGER_TYPE
    # TriggerDesc 必须是连续无空格的 JSON 字符串。
    request.TriggerDesc = json.dumps(URL_TRIGGER_DESC, separators=(",", ":"))
    request.Namespace = namespace
    request.Qualifier = QUALIFIER
    request.Enable = "OPEN"
    call_api(client, "CreateTrigger", request)


def update_function_url_auth(client: Any, namespace: str, trigger: Any) -> None:
    from tencentcloud.scf.v20180416 import models

    request = models.UpdateTriggerRequest()
    request.FunctionName = FUNCTION_NAME
    request.TriggerName = str(_field(trigger, "TriggerName", "") or URL_TRIGGER_NAME)
    request.Type = URL_TRIGGER_TYPE
    request.TriggerDesc = json.dumps(URL_TRIGGER_DESC, separators=(",", ":"))
    request.Namespace = namespace
    request.Qualifier = QUALIFIER
    request.Enable = "OPEN"
    call_api(client, "UpdateTrigger", request)


def ensure_function_url(
    client: Any,
    namespace: str,
    *,
    attempts: int = URL_TRIGGER_ATTEMPTS,
    delay: float = URL_TRIGGER_DELAY_SECONDS,
    sleep: Callable[[float], None] = time.sleep,
) -> str:
    """确保函数 URL 存在且为开放鉴权，回读并返回其地址。

    触发器是异步创建的：刚创建/刚改鉴权时列表与地址都可能滞后，因此短暂重试。
    读不到地址即失败退出——打印不出地址等同于本步骤没有完成。
    """

    trigger = find_url_trigger(list_triggers(client, namespace))
    changed = False
    if trigger is None:
        create_function_url(client, namespace)
        changed = True
    elif trigger_auth_type(trigger) not in ("", URL_AUTH_TYPE):
        update_function_url_auth(client, namespace, trigger)
        changed = True

    if changed or not trigger_url(trigger):
        trigger = wait_for_url_trigger(
            client, namespace, attempts=attempts, delay=delay, sleep=sleep
        )

    if trigger is None:
        raise DeploymentError("函数 URL 创建后未回读到触发器")
    auth_type = trigger_auth_type(trigger)
    if auth_type and auth_type != URL_AUTH_TYPE:
        raise DeploymentError("函数 URL 鉴权不是开放，请检查函数 URL 配置")
    if str(_field(trigger, "Enable", "")) in {"0", "CLOSE"}:
        raise DeploymentError("函数 URL 处于关闭状态，请检查触发器配置")
    url = trigger_url(trigger)
    if not url:
        raise DeploymentError(
            "未从函数 URL 触发器读到地址，请在 SCF 控制台确认函数 URL"
        )
    return url


def ensure_concurrency(client: Any, namespace: str) -> None:
    from tencentcloud.scf.v20180416 import models

    request = models.PutReservedConcurrencyConfigRequest()
    request.FunctionName = FUNCTION_NAME
    request.Namespace = namespace
    request.ReservedConcurrencyMem = RESERVED_CONCURRENCY_MEM
    call_api(client, "PutReservedConcurrencyConfig", request)


def read_client_server_url(path: Path = CLIENT_SETTINGS_PATH) -> str:
    """读出客户端硬编码的函数 URL（`DEFAULT_SYNC_SERVER_URL`）。读不到返回空串。"""

    try:
        raw = path.read_text(encoding="utf-8")
    except OSError:
        return ""
    match = re.search(
        r"DEFAULT_SYNC_SERVER_URL\s*=\s*[\"']([^\"']+)[\"']",
        raw,
    )
    return match.group(1).strip() if match else ""


def verify_client_server_url(
    deployed_url: str,
    client_url: str,
) -> None:
    """函数 URL 与客户端常量必须一致。

    函数被重建时 URL 的实例 id 会变，而客户端把它编译进 bundle——不同步就是
    「全体客户端打旧地址、所有检查全绿」。宁可让部署失败。
    """

    if not deployed_url:
        raise DeploymentError("未能从函数 URL 触发器读到地址，无法校验与客户端一致")
    if not client_url:
        raise DeploymentError(
            "未能从 src/settings/pluginSettings/normalize.ts 读到 "
            "DEFAULT_SYNC_SERVER_URL，无法校验函数 URL 一致性"
        )
    if deployed_url.rstrip("/") != client_url.rstrip("/"):
        raise DeploymentError(
            "函数 URL 与客户端硬编码的 DEFAULT_SYNC_SERVER_URL 不一致："
            "请把客户端常量更新为本次部署的地址后重新提交"
        )


def deploy_package(client: Any, namespace: str, package: bytes) -> str:
    if function_exists(client, namespace):
        # 先收敛配置再换代码，两次变更之间等就绪：平台的并发更新会被拒绝。
        update_function_configuration(client, namespace)
        wait_for_function_ready(client, namespace)
        update_function_code(client, namespace, package)
    else:
        create_function(client, namespace, package)
    wait_for_function_ready(client, namespace)
    url = ensure_function_url(client, namespace)
    ensure_concurrency(client, namespace)
    return url


def deploy(source_dir: Path, secret_id: str, secret_key: str, namespace: str) -> str:
    if not secret_id or not secret_key:
        raise DeploymentError("缺少 TENCENT_SECRET_ID 或 TENCENT_SECRET_KEY")
    package = build_package(source_dir)

    from tencentcloud.common import credential
    from tencentcloud.common.profile.client_profile import ClientProfile
    from tencentcloud.common.profile.http_profile import HttpProfile
    from tencentcloud.scf.v20180416 import scf_client

    profile = ClientProfile(httpProfile=HttpProfile(reqTimeout=60))
    client = scf_client.ScfClient(
        credential.Credential(secret_id, secret_key), REGION, profile
    )
    return deploy_package(client, namespace, package)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=SOURCE_DIR,
        help="cloud/sync 源码目录",
    )
    args = parser.parse_args(argv)
    namespace = os.environ.get("SCF_NAMESPACE") or DEFAULT_NAMESPACE
    try:
        url = deploy(
            args.source,
            os.environ.get("TENCENT_SECRET_ID", ""),
            os.environ.get("TENCENT_SECRET_KEY", ""),
            namespace,
        )
    except DeploymentError as exc:
        print(f"部署失败: {exc}", file=sys.stderr)
        return 1
    except Exception:
        print(
            "部署失败: 无法读取源码、加载 SDK 或处理代码包；未输出敏感异常详情",
            file=sys.stderr,
        )
        return 1
    try:
        verify_client_server_url(url, read_client_server_url())
    except DeploymentError as exc:
        print(f"部署失败: {exc}", file=sys.stderr)
        return 1
    print(
        f"已确保 {REGION} / {namespace} / {FUNCTION_NAME} 的代码与函数 URL（开放鉴权），"
        f"并下发最大独占配额 {RESERVED_CONCURRENCY_MEM}MB"
        f"（约 {MAX_CONCURRENCY} 并发，需在控制台确认生效）"
    )
    if url:
        print(f"函数 URL: {url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
