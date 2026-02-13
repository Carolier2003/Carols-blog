/**
 * 计算文章阅读时间
 *
 * 中文阅读速度：约 300 字/分钟
 * 英文阅读速度：约 200 词/分钟
 *
 * @param content - 文章内容（Markdown 或纯文本）
 * @returns 阅读时间（分钟），至少 1 分钟
 */
export function getReadingTime(content: string): number {
  // 清理 Markdown 标记
  const cleanContent = content
    // 移除代码块
    .replace(/```[\s\S]*?```/g, '')
    // 移除行内代码
    .replace(/`[^`]*`/g, '')
    // 移除 HTML 标签
    .replace(/<[^>]*>/g, '')
    // 移除 Markdown 链接和图片标记，保留文本
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '$1')
    // 移除标题标记
    .replace(/^#{1,6}\s+/gm, '')
    // 移除粗体/斜体标记
    .replace(/[*_]{1,2}/g, '')
    // 移除引用标记
    .replace(/^>\s*/gm, '');

  // 统计中文字符（包括中文标点）
  const chineseChars = (cleanContent.match(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/g) || []).length;

  // 统计英文单词
  const englishWords = (cleanContent.match(/[a-zA-Z]+/g) || []).length;

  // 计算阅读时间（分钟）
  const chineseTime = chineseChars / 300;
  const englishTime = englishWords / 200;

  // 向上取整，至少 1 分钟
  return Math.max(1, Math.ceil(chineseTime + englishTime));
}

/**
 * 格式化阅读时间显示
 *
 * @param minutes - 阅读分钟数
 * @returns 格式化后的字符串，如 "5 分钟"
 */
export function formatReadingTime(minutes: number): string {
  return `${minutes} 分钟`;
}
