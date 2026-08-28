import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const LOCAL_FONTS = {
  normal: resolve(process.cwd(), "src/assets/fonts/DejaVuSansMono.ttf"),
  bold: resolve(process.cwd(), "src/assets/fonts/DejaVuSansMono-Bold.ttf"),
} as const;

async function loadGoogleFonts(): Promise<
  Array<{ name: string; data: ArrayBuffer; weight: number; style: string }>
> {
  const fontsConfig = [
    {
      name: "DejaVu Sans Mono",
      weight: 400,
      style: "normal",
    },
    {
      name: "DejaVu Sans Mono",
      weight: 700,
      style: "bold",
    },
  ];

  const fonts = await Promise.all(
    fontsConfig.map(async ({ name, weight, style }) => {
      const file = await readFile(weight === 700 ? LOCAL_FONTS.bold : LOCAL_FONTS.normal);
      const data = new Uint8Array(file).buffer;
      return { name, data, weight, style };
    })
  );

  return fonts;
}

export default loadGoogleFonts;
