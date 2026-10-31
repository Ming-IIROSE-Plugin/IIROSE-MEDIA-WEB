/**
 * 歌单 / 专辑内页的分段加载器：完整 id 列表在手，曲目详情按 100 首一段按需取回。
 *
 * - 翻页只在越过已取范围时取覆盖该页的段；同一段进行中或已取回都不重复请求。
 * - 显示某段的末页时预取下一段（失败静默，翻到该页时再取）。
 * - 段失败从缓存移除，下次 `loadPage` 只重取这一段。
 * - 段内结果按 id 顺序排，接口缺失的 id 跳过。
 * - `abort()` 中止未完成的段请求，之后的 `loadPage` 一律 reject。
 */
export type FetchSegment = (
  ids: number[],
  signal: AbortSignal,
) => Promise<PlatformData[] | null>;

export class CollectionSegments {
  private readonly controller = new AbortController();
  /** 段下标 → 该段曲目（id → 条目）；进行中的段也在这里（Promise 去重）。 */
  private readonly segments = new Map<
    number,
    Promise<Map<number, PlatformData>>
  >();

  constructor(
    private readonly ids: number[],
    private readonly fetchSegment: FetchSegment,
    private readonly segmentSize = 100,
  ) {}

  /** 曲目总数（按完整 id 列表，不按已取回的详情）。 */
  public get size(): number {
    return this.ids.length;
  }

  public get aborted(): boolean {
    return this.controller.signal.aborted;
  }

  public totalPage(perPage: number): number {
    return Math.ceil(this.ids.length / perPage);
  }

  public async loadPage(
    page: number,
    perPage: number,
  ): Promise<PlatformData[]> {
    const start = Math.max(0, (page - 1) * perPage);
    const end = Math.min(start + perPage, this.ids.length);
    if (start >= end) return [];
    const first = Math.floor(start / this.segmentSize);
    const last = Math.floor((end - 1) / this.segmentSize);

    const loaded = await Promise.all(
      Array.from({ length: last - first + 1 }, (_, i) =>
        this.ensure(first + i),
      ),
    );
    if (this.aborted) throw new Error("aborted");

    // 显示的是已取范围（最后一段）的末页：预取下一段
    const lastEnd = Math.min((last + 1) * this.segmentSize, this.ids.length);
    if (end >= lastEnd && lastEnd < this.ids.length)
      this.ensure(last + 1).catch(() => {});

    const result: PlatformData[] = [];
    for (let index = start; index < end; index++) {
      const songs = loaded[Math.floor(index / this.segmentSize) - first];
      const song = songs.get(this.ids[index]);
      if (song) result.push(song);
    }
    return result;
  }

  public abort(): void {
    this.controller.abort();
  }

  private ensure(segment: number): Promise<Map<number, PlatformData>> {
    if (this.aborted) return Promise.reject(new Error("aborted"));
    const cached = this.segments.get(segment);
    if (cached) return cached;

    const ids = this.ids.slice(
      segment * this.segmentSize,
      (segment + 1) * this.segmentSize,
    );
    const pending = this.fetchSegment(ids, this.controller.signal).then(
      (songs) => {
        if (!songs || this.aborted) throw new Error("段加载失败");
        const byId = new Map<number, PlatformData>();
        for (const song of songs) {
          const id = song.neteaseMusic?.id;
          if (id !== undefined) byId.set(id, song);
        }
        return byId;
      },
    );
    this.segments.set(segment, pending);
    // 失败（含中止）不留缓存：重试只重取这一段
    pending.catch(() => {
      if (this.segments.get(segment) === pending) this.segments.delete(segment);
    });
    return pending;
  }
}
