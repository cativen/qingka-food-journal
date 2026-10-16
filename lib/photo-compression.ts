export type CompressedPhoto = {
  file: File;
  originalBytes: number;
  compressedBytes: number;
  ratio: number;
  width: number;
  height: number;
};

/**
 * Target ~10% of the ORIGINAL upload's bytes, rather than generating an
 * extremely small fixed-size preview. Preserve aspect ratio; encode WebP at
 * balanced quality and adjust the image dimensions to approach the target.
 */
export async function compressPhotoToTenPercent(input: File): Promise<CompressedPhoto> {
  if (!input.type.startsWith('image/')) throw new Error('只支持图片文件');
  if (input.size === 0 || input.size > 24 * 1024 * 1024) {
    throw new Error('原图大小必须在 0–24 MB 之间');
  }

  const source = await createImageBitmap(input);
  try {
    const targetBytes = Math.max(1, Math.round(input.size * 0.10));
    let low = 0.20;
    let high = 1.0;
    let best: { blob: Blob; width: number; height: number; delta: number } | null = null;

    // WebP at balanced quality keeps details better than thumbnails saved
    // at tiny dimensions. Binary search the scale, not the visual quality.
    for (let attempt = 0; attempt < 9; attempt++) {
      const scale = attempt === 0 ? 1 : (low + high) / 2;
      const width = Math.max(1, Math.round(source.width * scale));
      const height = Math.max(1, Math.round(source.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('无法创建图片处理画布');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(source, 0, 0, width, height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(result => {
          if (result) resolve(result);
          else reject(new Error('图片压缩失败'));
        }, 'image/webp', 0.82);
      });
      // Old browsers may silently return PNG when WebP isn't supported.
      if (blob.type !== 'image/webp') throw new Error('当前浏览器暂不支持 WebP 图片压缩');

      const delta = Math.abs(blob.size - targetBytes);
      if (!best || delta < best.delta) best = { blob, width, height, delta };
      if (blob.size > targetBytes) high = scale;
      else low = scale;
      if (delta <= targetBytes * 0.04) break;
    }
    if (!best) throw new Error('图片压缩失败');
    const decoded = await createImageBitmap(best.blob);
    try {
      if (!decoded.width || !decoded.height) throw new Error('图片无法解码');
    } finally {
      decoded.close();
    }

    const basename = input.name.replace(/\.[^.]+$/, '') || 'meal-photo';
    const file = new File([best.blob], basename + '.webp', { type: 'image/webp' });
    return {
      file,
      originalBytes: input.size,
      compressedBytes: file.size,
      ratio: file.size / input.size,
      width: best.width,
      height: best.height,
    };
  } finally {
    source.close();
  }
}
