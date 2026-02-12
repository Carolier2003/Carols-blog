interface Window {
  theme?: {
    themeValue: string;
    setPreference: () => void;
    reflectPreference: () => void;
    getTheme: () => string;
    setTheme: (val: string) => void;
  };
  /** 浏览量计数器初始化标志 */
  __viewCounterInit?: boolean;
}
