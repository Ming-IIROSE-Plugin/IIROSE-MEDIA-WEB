---
topic: 音乐模式搜索后回到最近点播首屏
updated: 2026-11-04T18:48
---

- (direction) 用户反馈：开始搜索歌曲后就回不去最近点播，要求可以回去
- (note) 代码核实：submitSearch 空词直接 return（mainAppContainerController.ts:96），搜过一次后只有刷新页面能回首屏
- (decision) 入口：输入框有内容时显示清除钮，点击立即回去；手动删空后回车或点搜索也回去；删字过程结果不变（否决删空即回：改词时结果区会闪回）
- (decision) 清除时停在专辑/歌单/MV：自动跳回单曲范围并显示最近点播
- (decision) 范围只改音乐模式；视频/电台/收藏行为不变
- (capability) CAP-1 清除钮：音乐模式输入框有内容时显示，点击清空输入并回最近点播
- (capability) CAP-2 空词提交：音乐模式已搜索状态下删空后回车/点搜索回最近点播；首屏空提交无动作
- (capability) CAP-3 回到首屏后可再次搜索，含聊天框 @ 与刚才相同的关键词
- (constraint) 控制层 changeSearchKeyword 吞空词，清除后全局词停在旧值，@ 同词 props 不变不触发；必须修
- (constraint) 迟到的搜索结果不得覆盖首屏
- (constraint) 复用 runSearch 与最近点播供数，回首屏不出网；复用 tokens 的 DeskIcon close 与令牌，手机点击目标不小于 44px
- (assumption) @ 同词复搜未经用户直接确认，按『回去后状态应干净』推定
- (assumption) 未提交的输入也算有内容：首屏点清除钮只清空输入，不重载列表
- (note) Non-goals：不加最近点播标签、不保留上次搜索结果、不做搜索历史、不加删除历史入口
- (event) Pass 1 coherence：Spec Law 1-6、8 通过；Pass 2 preservation：用户诉求与三项选择均已落入 SPEC，无 wrapper 内容丢弃
- (event) SPEC.md 派生完成，3 个 capability，无 companion，无开放问题
