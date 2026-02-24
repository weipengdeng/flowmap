import { CanvasTexture, RepeatWrapping, Texture, TextureLoader } from "three";

export function createStrokeAlphaMaskTexture(size = 256): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create alpha mask canvas context.");
  }

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < 600; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = size * (0.03 + Math.random() * 0.15);
    const angle = Math.random() * Math.PI * 2;
    const alpha = 0.06 + Math.random() * 0.22;

    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
    ctx.lineWidth = 1 + Math.random() * 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }

  for (let i = 0; i < 1200; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 1.8;
    const a = 0.05 + Math.random() * 0.1;
    ctx.fillStyle = `rgba(255, 255, 255, ${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

export async function loadStrokeAlphaMaskTexture(
  url = "/textures/stroke-alpha.png"
): Promise<Texture> {
  const loader = new TextureLoader();
  try {
    const texture = await loader.loadAsync(url);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    return texture;
  } catch {
    return createStrokeAlphaMaskTexture();
  }
}

