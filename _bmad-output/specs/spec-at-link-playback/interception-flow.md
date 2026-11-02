# 输入框拦截与解析流程 (Interception & Resolution Flow)

本文档通过时序图与流程图呈现输入框 `@` 事件拦截、私聊防泄露同步契约以及后台异步解析流水线。

## 1. 私聊与公屏输入拦截时序图 (Private Chat vs Room Flow)

```mermaid
sequenceDiagram
    autonumber
    actor User as 用户
    participant Input as 输入框 (moveinput)
    participant Host as 宿站 service.moveinputDo
    participant Plugin as 插件代理 (changedOriginalMoveInputDo)
    participant Worker as 异步点播分发器 (Background Task)
    participant Chat as 宿站消息发送 (msgfetch)

    User->>Input: 输入 "@https://..." 或 "@歌名" 并回车
    alt 插件设置中关闭了代理 (isProxyAtInput = false)
        Input->>Host: 宿站原生 moveinputDo(text, t)
        Host-->>User: 宿站原生行为处理
    else 开启代理模式 (isProxyAtInput = true)
        alt 在公屏房间中
            Input->>Plugin: moveinputDo(text, undefined)
            Plugin->>Plugin: 识别到 @ 指令
            Plugin-->>Input: 清空输入框并同步返回 false
            Plugin->>Worker: 派发异步解析与点播/搜索
        else 在私聊窗口中 (pmFull)
            Input->>Plugin: moveinputDo(text, 1)
            Note over Plugin: 必须同步返回 falsy，绝不能返回 Promise！
            Plugin-->>Input: 同步返回 false
            Note over Input: 宿站检测 !result 为真，执行 moveinput.val('')
            Note over Chat: msgfetch 被阻断，私聊消息不会发出！
            Plugin->>Worker: 派发异步解析与点播/搜索
        end
        Worker->>Worker: 提取URL / 经CORS代理重定向 / 探测媒体 / 构造卡片
        Worker->>User: 房间开始播放 / 弹出选集多选框 / 呼出搜索面板
    end
```

---

## 2. 链接解析与分发流程图 (Link Parsing & Dispatch Flowchart)

```mermaid
flowchart TD
    A["用户输入文本 (以 @ 开头)"] --> B{"是否为宿站快捷键?<br>(如 @!, @@#, @$ 等)"}
    B -- "是" --> C["放行: backupMethod(e, t)"]
    B -- "否" --> D{"是否包含 URL 实体?"}

    D -- "否 (纯文本)" --> E["纯文本 @搜索 处理"]
    E --> E1["展开媒体面板 ShowOrHideIMC()"]
    E1 --> E2["填入关键词 changeSearchKeyword()"]
    E --> RET["同步返回 false"]

    D -- "是" --> F["提取 URL 字符串并规范化"]
    F --> RET
    F --> G{"域名识别"}

    G -- "163cn.tv / b23.tv 短链" --> H["走 CORS 代理发起 HEAD/GET<br>读取 302 Location"]
    H --> G

    G -- "music.163.com" --> I{"判断类型 (song / album / playlist)"}
    I -- "单曲" --> I1["NetEasePlatform.MOD()"]
    I -- "专辑 / 歌单" --> I2["弹出一级选择器:<br>正序 / 乱序 / 选集点播"]
    I2 -- "选集点播" --> I3["唤起多选列表勾选子集<br>完成二次确认正序/乱序并播放"]

    G -- "bilibili.com" --> J{"提取 BVID 与分 P 参数"}
    J -- "携带 ?p=N" --> J1["直接点播第 N P"]
    J -- "未带 p 且为多分P" --> J2["弹出一级选择器:<br>正序 / 乱序 / 选集点播"]
    J2 -- "选集点播" --> J3["唤起分 P 多选列表<br>完成二次确认正序/乱序并播放"]
    J -- "单P视频" --> J4["直接点播单集"]

    G -- "其他域名 / 直链候选" --> K{"检查媒体扩展名<br>(mp3/mp4/m3u8等)"}
    K -- "命中扩展名" --> L["探测时长并生成媒体卡片点播<br>(默认封面与'直链播放'占位)"]
    K -- "未命中" --> M["HEAD 探测 Content-Type (8s 超时)"]
    M -- "为 audio/* 或 video/*" --> L
    M -- ">8s 超时" --> M1["ShowMessage.show('直链媒体探测超时')"]
    M -- "明确非媒体 (如 text/html)" --> N["放行: backupMethod(e, t)<br>宿站原生处理"]
```
