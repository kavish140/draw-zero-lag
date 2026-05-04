// Scanline flood fill for canvas
export function floodFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fillHex: string,
) {
  const { width, height } = ctx.canvas;
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= width || y >= height) return;

  const img = ctx.getImageData(0, 0, width, height);
  const data = img.data;
  const target = getPixel(data, x, y, width);
  const fill = hexToRgba(fillHex);
  if (colorsEqual(target, fill)) return;

  const stack: [number, number][] = [[x, y]];
  while (stack.length) {
    const [sx, sy] = stack.pop()!;
    let nx = sx;
    while (nx >= 0 && colorsEqual(getPixel(data, nx, sy, width), target)) nx--;
    nx++;
    let spanUp = false;
    let spanDown = false;
    while (nx < width && colorsEqual(getPixel(data, nx, sy, width), target)) {
      setPixel(data, nx, sy, width, fill);
      if (sy > 0) {
        const up = getPixel(data, nx, sy - 1, width);
        if (!spanUp && colorsEqual(up, target)) {
          stack.push([nx, sy - 1]);
          spanUp = true;
        } else if (spanUp && !colorsEqual(up, target)) spanUp = false;
      }
      if (sy < height - 1) {
        const dn = getPixel(data, nx, sy + 1, width);
        if (!spanDown && colorsEqual(dn, target)) {
          stack.push([nx, sy + 1]);
          spanDown = true;
        } else if (spanDown && !colorsEqual(dn, target)) spanDown = false;
      }
      nx++;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function getPixel(data: Uint8ClampedArray, x: number, y: number, w: number) {
  const i = (y * w + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]] as const;
}
function setPixel(
  data: Uint8ClampedArray,
  x: number,
  y: number,
  w: number,
  c: readonly [number, number, number, number],
) {
  const i = (y * w + x) * 4;
  data[i] = c[0];
  data[i + 1] = c[1];
  data[i + 2] = c[2];
  data[i + 3] = c[3];
}
function colorsEqual(a: readonly number[], b: readonly number[]) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}
function hexToRgba(hex: string): [number, number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}
