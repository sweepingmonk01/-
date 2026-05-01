import type { HomeworkVisualSignal } from '../domain/types.js';

interface ImageMetadata {
  width?: number;
  height?: number;
  decodedBytes: number;
  format: string;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const buildHomeworkVisualSignals = (input: {
  imageBase64: string;
  mimeType: string;
}): HomeworkVisualSignal[] => {
  const metadata = readImageMetadata(input);
  const signals: HomeworkVisualSignal[] = [{
    kind: 'image-format',
    label: `${metadata.format.toUpperCase()} 图像输入`,
    severity: 'info',
    confidence: 0.9,
    evidence: [`payload≈${formatKilobytes(metadata.decodedBytes)}`],
  }];

  if (!metadata.width || !metadata.height) {
    signals.push({
      kind: 'capture-risk',
      label: '图像尺寸不可读',
      severity: metadata.decodedBytes < 32_000 ? 'risk' : 'watch',
      confidence: 0.55,
      evidence: ['只能使用模型视觉识别，无法先做版式预判'],
    });
    return signals;
  }

  const aspect = metadata.height / metadata.width;
  const megapixels = (metadata.width * metadata.height) / 1_000_000;
  const resolution = `${metadata.width}x${metadata.height}`;

  if (aspect >= 2.2) {
    signals.push({
      kind: 'page-shape',
      label: '长截图作业页',
      severity: 'watch',
      confidence: 0.82,
      evidence: [`resolution=${resolution}`, `height/width=${aspect.toFixed(2)}`],
    });
  } else if (aspect >= 1.25) {
    signals.push({
      kind: 'page-shape',
      label: '竖版整页作业',
      severity: 'info',
      confidence: 0.78,
      evidence: [`resolution=${resolution}`, `height/width=${aspect.toFixed(2)}`],
    });
  } else if (aspect <= 0.75) {
    signals.push({
      kind: 'page-shape',
      label: '横向拍摄或截屏',
      severity: 'watch',
      confidence: 0.72,
      evidence: [`resolution=${resolution}`, `height/width=${aspect.toFixed(2)}`],
    });
  } else {
    signals.push({
      kind: 'page-shape',
      label: '局部题图',
      severity: 'info',
      confidence: 0.68,
      evidence: [`resolution=${resolution}`],
    });
  }

  if (megapixels >= 4) {
    signals.push({
      kind: 'detail-density',
      label: '高细节图像',
      severity: 'watch',
      confidence: 0.76,
      evidence: [`megapixels=${megapixels.toFixed(1)}`],
    });
  } else if (megapixels < 0.35) {
    signals.push({
      kind: 'capture-risk',
      label: '低分辨率题图',
      severity: 'risk',
      confidence: 0.8,
      evidence: [`megapixels=${megapixels.toFixed(2)}`],
    });
  }

  return signals.slice(0, 4);
};

const readImageMetadata = (input: { imageBase64: string; mimeType: string }): ImageMetadata => {
  const bytes = Buffer.from(input.imageBase64.replace(/^data:[^,]+,/, ''), 'base64');
  const format = input.mimeType.split('/')[1]?.toLowerCase() || 'image';
  const pngDimensions = readPngDimensions(bytes);
  if (pngDimensions) {
    return { ...pngDimensions, decodedBytes: bytes.length, format };
  }

  const jpegDimensions = readJpegDimensions(bytes);
  if (jpegDimensions) {
    return { ...jpegDimensions, decodedBytes: bytes.length, format };
  }

  return {
    decodedBytes: bytes.length,
    format,
  };
};

const readPngDimensions = (bytes: Buffer): { width: number; height: number } | null => {
  if (bytes.length < 24 || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return null;
  }

  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  return width > 0 && height > 0 ? { width, height } : null;
};

const readJpegDimensions = (bytes: Buffer): { width: number; height: number } | null => {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1]!;
    const segmentLength = bytes.readUInt16BE(offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > bytes.length) break;

    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb)) {
      const height = bytes.readUInt16BE(offset + 5);
      const width = bytes.readUInt16BE(offset + 7);
      return width > 0 && height > 0 ? { width, height } : null;
    }

    offset += 2 + segmentLength;
  }

  return null;
};

const formatKilobytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes}B`;
  return `${Math.round(bytes / 1024)}KB`;
};
