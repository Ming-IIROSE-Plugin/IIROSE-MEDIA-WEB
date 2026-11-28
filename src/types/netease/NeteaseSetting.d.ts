interface NeteaseSetting {
  quality: NeteaseSongQuality;
  api: import("../../Api/NeteaseAPI/Nodes").NeteaseNodeId;
  lyricOption: "off" | "original" | "translated" | "both";
}

type NeteaseSongQuality =
  | "standard"
  | "higher"
  | "exhigh"
  | "lossless"
  | "hires"
  | "jyeffect"
  | "sky"
  | "jymaster";
