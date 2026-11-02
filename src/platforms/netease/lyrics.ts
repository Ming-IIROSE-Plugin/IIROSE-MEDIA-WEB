import { NetEaseSettings } from "../../settings/neteaseSettings/NetEaseSettings";

/**
 * @description 合并歌词
 * @param jpLyrics
 * @param cnLyrics
 * @returns
 */
export const mergeLyrics = (jpLyrics: string, cnLyrics: string): string => {
  const neteaseSetting = NetEaseSettings.getNeteaseMusicSetting();

  const lyricOption = neteaseSetting.lyricOption;

  if (lyricOption === "off") return "";

  if (lyricOption === "original") return jpLyrics;

  if (lyricOption === "translated") return cnLyrics;

  const jpLines = jpLyrics.split("\n");
  const cnLines = cnLyrics.split("\n");

  const jpEntries: { [key: string]: string } = {};
  const cnEntries: { [key: string]: string } = {};

  // Parse Japanese lyrics
  for (const line of jpLines) {
    const timeRegex = /\[(\d+:\d+\.\d+)\]/;
    const timeMatch = line.match(timeRegex);
    if (timeMatch) {
      const time = timeMatch[1];
      const content = line.replace(timeRegex, "").trim();
      jpEntries[time] = content;
    }
  }

  // Parse Chinese lyrics
  for (const line of cnLines) {
    const timeRegex = /\[(\d+:\d+\.\d+)\]/;
    const timeMatch = line.match(timeRegex);
    if (timeMatch) {
      const time = timeMatch[1];
      const content = line.replace(timeRegex, "").trim();
      cnEntries[time] = content;
    }
  }

  // Merge and format
  const mergedLines: {
    time: string;
    content: string;
    translation: string;
  }[] = [];
  for (const time in jpEntries) {
    const jpContent = jpEntries[time];
    const cnContent = cnEntries[time] || ""; // Use empty string if no translation

    mergedLines.push({ time, content: jpContent, translation: cnContent });
  }

  // Format the merged lines
  const mergedOutput = mergedLines
    .map((line) => {
      const { time, content, translation } = line;
      let outputLine = `[${time}] ${content}`;
      if (translation) {
        outputLine += ` | ${translation}`;
      }
      return outputLine;
    })
    .join("\n");

  return mergedOutput;
};
