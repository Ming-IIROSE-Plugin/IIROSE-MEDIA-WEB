// 搜索栏（DESIGN.md `search-bar` / `source-switcher` / `search-submit` / `key-hint`）。
// 一个整体：来源切换器 → 竖分隔线 → 放大镜 + 输入区（蔷薇红光标）→ 键位提示 → 墨底「搜索」。
// 手机只保留来源简称 + 输入区（16px 防 iOS 聚焦放大），不显示键位提示与搜索按钮。
import { Component, createRef } from "preact";
import {
  DeskIcon,
  deskCaret,
  deskFocusRing,
  deskFocusRingOnInk,
  deskHover,
  deskInk,
  deskInk3,
  deskInkSurface,
  deskPaperText,
  deskPlaceholder,
  deskRule,
  deskRuleFill,
  deskSearchShadow,
  deskSheet,
  deskSourceDots,
  roundedMd,
  roundedXl,
  roundedXs,
  typeKeyHint,
  typeLabel,
  typeLabelStrong,
  typeSearchQuery,
  type DeskSourceKey,
  deskPress,
} from "../floating-panel/tokens";
import { detectVideoTarget } from "./searchIntent";
import { SourceMenu } from "./SourceMenu";

export interface SearchSource {
  /** 桌面全称（来源切换器里显示）。 */
  label: string;
  /** 手机简称。 */
  short: string;
  /** 来源圆点；收藏模式的「全部」没有圆点。 */
  dot?: DeskSourceKey | null;
}

export interface SearchBarProps {
  keyword: string;
  placeholder: string;
  /** 手机占位文案（缺省用 placeholder）。 */
  placeholderPhone?: string;
  sources: SearchSource[];
  sourceIndex: number;
  onSelectSource: (index: number) => void;
  onSubmit: (keyword: string) => void;
  /** 输入即通知（收藏 / 电台的即时过滤）；Enter / 按钮提交仍走 `onSubmit`。 */
  onLiveInput?: (keyword: string) => void;
}

interface SearchBarState {
  value: string;
  /** 来源菜单是否展开。 */
  menuOpen: boolean;
}

/** 主面板是否处于打开状态：`/` 只在面板打开时抢焦点。 */
function panelVisible(): boolean {
  return !!document
    .getElementById("IIROSE_MEDIA_CONTAINER")
    ?.classList.contains("ShowIIROSE_MEDIA_CONTAINER");
}

const TEXT_ENTRY = /^(INPUT|TEXTAREA|SELECT)$/;

export class SearchBar extends Component<SearchBarProps, SearchBarState> {
  private inputRef = createRef<HTMLInputElement>();
  private sourceButtonRef = createRef<HTMLButtonElement>();

  private closeMenu = () => {
    if (!this.state.menuOpen) return;
    this.setState({ menuOpen: false });
    // 关闭后焦点还给切换器（键盘用户接着操作）
    this.sourceButtonRef.current?.focus({ preventScroll: true });
  };

  private pickSource = (index: number) => {
    this.closeMenu();
    if (index !== this.props.sourceIndex) this.props.onSelectSource(index);
  };
  /** 输入法组字中：拼音逐字不触发过滤，组字结束再通知一次最终值。 */
  private composing = false;

  constructor(props: SearchBarProps) {
    super(props);
    this.state = { value: props.keyword, menuOpen: false };
  }

  /** 桌面打开面板时把焦点放进输入区（手机不自动聚焦，避免弹键盘）。 */
  public focus() {
    this.inputRef.current?.focus();
  }

  componentDidMount() {
    document.addEventListener("keydown", this.handleShortcut);
    this.bindComposition();
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.handleShortcut);
    this.unbindComposition();
  }

  componentDidUpdate(prevProps: SearchBarProps) {
    // 外部改词（@ 链接、切换模式恢复快照）时同步输入区
    if (
      prevProps.keyword !== this.props.keyword &&
      this.props.keyword !== this.state.value
    ) {
      this.setState({ value: this.props.keyword });
    }
  }

  private handleShortcut = (event: KeyboardEvent) => {
    if (event.key !== "/" || event.altKey || event.ctrlKey || event.metaKey)
      return;
    if (!panelVisible()) return;
    // 输入框内的 `/` 照常输入
    const target = event.target as HTMLElement | null;
    if (target && (target.isContentEditable || TEXT_ENTRY.test(target.tagName)))
      return;
    event.preventDefault();
    this.focus();
  };

  /**
   * 输入法组字用原生监听挂到输入框上：Preact 的 `onCompositionStart` 依赖
   * `oncompositionstart` 是 DOM 属性，缺它的环境（jsdom）会挂错事件名。
   */
  private bindComposition() {
    const node = this.inputRef.current;
    if (!node) return;
    node.addEventListener("compositionstart", this.handleCompositionStart);
    node.addEventListener("compositionend", this.handleCompositionEnd);
  }

  private unbindComposition() {
    const node = this.inputRef.current;
    if (!node) return;
    node.removeEventListener("compositionstart", this.handleCompositionStart);
    node.removeEventListener("compositionend", this.handleCompositionEnd);
  }

  private handleCompositionStart = () => {
    this.composing = true;
  };

  private handleCompositionEnd = (event: CompositionEvent) => {
    this.composing = false;
    this.props.onLiveInput?.((event.currentTarget as HTMLInputElement).value);
  };

  private submit() {
    this.props.onSubmit(this.state.value);
  }

  private handlePaste = (event: ClipboardEvent) => {
    const text = event.clipboardData?.getData("text") ?? "";
    const target = detectVideoTarget(text);
    if (!target) return; // 普通文本照常粘贴
    event.preventDefault();
    this.setState({ value: target });
    this.props.onSubmit(target);
  };

  private placeholder = () =>
    this.props.placeholderPhone &&
    window.matchMedia?.("(max-width: 768px)")?.matches
      ? this.props.placeholderPhone
      : this.props.placeholder;

  render() {
    const { sources, sourceIndex } = this.props;
    const source = sources[sourceIndex] ?? sources[0];
    const dot = source?.dot ? deskSourceDots[source.dot] : "";
    const hint = this.state.value.trim() ? "Enter" : "/";

    return (
      <div
        className={`mx-[36px] mt-5 flex h-14 items-center border border-solid px-1.5 ${roundedXl} ${deskRule} ${deskSheet} ${deskSearchShadow} max-[768px]:mx-4 max-[768px]:mt-4 max-[768px]:h-[50px]`}
      >
        {/* 来源切换器：插件自有下拉（原生 select 的展开样式由系统决定，深色下是白底蓝条） */}
        <div className="relative shrink-0">
          <button
            ref={this.sourceButtonRef}
            type="button"
            aria-label={`来源：${source?.label ?? ""}`}
            aria-haspopup="listbox"
            aria-expanded={this.state.menuOpen}
            className={`flex h-[42px] cursor-pointer items-center gap-2 border-0 px-3 ${roundedMd} ${deskHover} ${deskInk} ${typeLabel} ${deskFocusRing} ${deskPress} max-[768px]:h-[38px] max-[768px]:gap-1.5 max-[768px]:px-2.5`}
            onClick={() => this.setState({ menuOpen: !this.state.menuOpen })}
            onKeyDown={(event) => {
              if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
              event.preventDefault();
              this.setState({ menuOpen: true });
            }}
          >
            {source?.dot && (
              <span
                aria-hidden="true"
                className={`h-[7px] w-[7px] shrink-0 rounded-full ${dot}`}
              />
            )}
            <span className="whitespace-nowrap max-[768px]:hidden">
              {source?.label}
            </span>
            <span className="hidden whitespace-nowrap max-[768px]:inline">
              {source?.short}
            </span>
            <span
              className={`${deskInk3} transition-[rotate] duration-200 ${this.state.menuOpen ? "rotate-180" : "rotate-0"}`}
            >
              <DeskIcon name="chev" size={16} />
            </span>
          </button>
          {this.state.menuOpen && (
            <SourceMenu
              sources={sources}
              selectedIndex={sourceIndex}
              onSelect={this.pickSource}
              onClose={this.closeMenu}
            />
          )}
        </div>

        <span
          aria-hidden="true"
          className={`mx-3 h-6 w-px shrink-0 max-[768px]:hidden ${deskRuleFill}`}
        />

        <span className={`ml-2.5 shrink-0 max-[768px]:ml-1 ${deskInk3}`}>
          <DeskIcon name="search" size={20} />
        </span>

        <input
          ref={this.inputRef}
          type="text"
          enterKeyHint="search"
          aria-label="搜索"
          className={`min-w-0 flex-1 border-0 bg-transparent px-2.5 py-0 outline-none ${typeSearchQuery} ${deskInk} ${deskCaret} ${deskPlaceholder}`}
          placeholder={this.placeholder()}
          value={this.state.value}
          onInput={(event) => {
            const value = event.currentTarget.value;
            this.setState({ value });
            // 组字中的拼音不是最终过滤词：否则每个字母都会把列表收窄到空
            if (this.composing || (event as unknown as InputEvent).isComposing)
              return;
            this.props.onLiveInput?.(value);
          }}
          onPaste={this.handlePaste}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            this.submit();
          }}
        />

        <kbd
          className={`mr-1 shrink-0 border border-solid px-[7px] py-[3px] ${roundedXs} ${deskRule} ${deskInk3} ${typeKeyHint} max-[768px]:hidden`}
        >
          {hint}
        </kbd>

        <button
          type="button"
          className={`mr-0.5 flex h-[42px] shrink-0 cursor-pointer items-center border-0 px-[18px] ${roundedMd} ${deskInkSurface} ${deskPaperText} ${typeLabelStrong} ${deskFocusRingOnInk} ${deskPress} max-[768px]:hidden`}
          onClick={() => this.submit()}
        >
          搜索
        </button>
      </div>
    );
  }
}
