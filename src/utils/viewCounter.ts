/**
 * 浏览量统计相关工具函数
 */

// API 基础 URL
export const VIEW_API_BASE = "https://api.kon-carol.xyz";

/**
 * 格式化数字显示 (如: 1200 -> 1.2k)
 */
export function formatCount(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "k";
  }
  return num.toString();
}

/**
 * 从 sessionStorage 读取浏览量缓存
 * @returns 缓存的浏览量数据，过期返回空对象
 */
export function getCachedViews(): Record<string, number> {
  try {
    const cached = sessionStorage.getItem("viewCounts");
    const timestamp = sessionStorage.getItem("viewCountsTimestamp");
    // 缓存 5 分钟
    if (cached && timestamp && Date.now() - parseInt(timestamp) < 5 * 60 * 1000) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.debug("Failed to read cache:", e);
  }
  return {};
}

/**
 * 写入浏览量缓存到 sessionStorage
 */
export function setCachedViews(views: Record<string, number>): void {
  try {
    sessionStorage.setItem("viewCounts", JSON.stringify(views));
    sessionStorage.setItem("viewCountsTimestamp", Date.now().toString());
  } catch (e) {
    console.debug("Failed to write cache:", e);
  }
}

/**
 * 检查是否已经记录过浏览量（使用 localStorage）
 * @param slug 文章 slug
 * @returns 24 小时内是否已浏览
 */
export function hasViewed(slug: string): boolean {
  try {
    const key = `viewed:${encodeURIComponent(slug)}`;
    const lastViewed = localStorage.getItem(key);

    if (!lastViewed) {
      return false;
    }

    // 24 小时内不重复计数
    const lastTime = parseInt(lastViewed, 10);
    const now = Date.now();
    const hoursPassed = (now - lastTime) / (1000 * 60 * 60);

    return hoursPassed < 24;
  } catch (e) {
    console.debug("Failed to check viewed status:", e);
    return false;
  }
}

/**
 * 标记已浏览
 * @param slug 文章 slug
 */
export function markViewed(slug: string): void {
  try {
    const key = `viewed:${encodeURIComponent(slug)}`;
    localStorage.setItem(key, Date.now().toString());
  } catch (e) {
    console.debug("Failed to mark viewed:", e);
  }
}

/**
 * 验证批量查询响应数据格式
 */
export function isValidBatchResponse(data: unknown): data is { success: boolean; views: Record<string, number> } {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    d.success === true &&
    typeof d.views === "object" &&
    d.views !== null &&
    !Array.isArray(d.views)
  );
}
