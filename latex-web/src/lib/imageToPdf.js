import { closeDocument, loadPdfjs } from './pdfjs.js';

// Converts images (and binary PDFs, via rasterisation) into a 7-bit ASCII PDF.
//
// texlive.net only accepts text form fields, so binary files cannot be sent as-is.
// A PDF whose streams use the ASCII85Decode filter is pure ASCII and survives the
// transfer; the compile wrapper then tells graphicx to treat the original
// extension (.png, .jpg, ...) as a PDF graphic.

function ascii85(bytes) {
  let out = '';
  let line = 0;
  const push = (s) => {
    out += s;
    line += s.length;
    if (line >= 75) {
      out += '\n';
      line = 0;
    }
  };
  for (let i = 0; i < bytes.length; i += 4) {
    const n = Math.min(4, bytes.length - i);
    let v = 0;
    for (let k = 0; k < 4; k++) v = v * 256 + (k < n ? bytes[i + k] : 0);
    if (v === 0 && n === 4) {
      push('z');
      continue;
    }
    const chars = new Array(5);
    for (let k = 4; k >= 0; k--) {
      chars[k] = String.fromCharCode((v % 85) + 33);
      v = Math.floor(v / 85);
    }
    push(chars.slice(0, n + 1).join(''));
  }
  return `${out}~>`;
}

async function deflate(bytes) {
  const cs = new CompressionStream('deflate');
  const stream = new Blob([bytes]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function buildPdf(width, height, imageDict, imageData, smask) {
  const objects = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  const smaskRef = smask ? ' /SMask 6 0 R' : '';
  objects.push(`<< ${imageDict}${smaskRef} /Length ${imageData.length} >>\nstream\n${imageData}\nendstream`);
  const content = `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`;
  objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  if (smask) objects.push(`<< ${smask.dict} /Length ${smask.data.length} >>\nstream\n${smask.data}\nendstream`);

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}

async function drawToCanvas(source, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

async function loadImage(blob) {
  if (blob.type === 'image/svg+xml') {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      // Rasterise SVGs at 3x for decent print quality.
      const w = Math.max(1, Math.round((img.naturalWidth || 300) * 3));
      const h = Math.max(1, Math.round((img.naturalHeight || 150) * 3));
      return { canvas: await drawToCanvas(img, w, h), scale: 1 / 3 };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const bmp = await createImageBitmap(blob);
  return { canvas: await drawToCanvas(bmp, bmp.width, bmp.height), scale: 1 };
}

async function canvasToPdf(canvas, scale, preferJpeg) {
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, width, height);
  const rgb = new Uint8Array(width * height * 3);
  const alpha = new Uint8Array(width * height);
  let hasAlpha = false;
  for (let i = 0, j = 0, k = 0; i < data.length; i += 4, j += 3, k++) {
    rgb[j] = data[i];
    rgb[j + 1] = data[i + 1];
    rgb[j + 2] = data[i + 2];
    alpha[k] = data[i + 3];
    if (data[i + 3] !== 255) hasAlpha = true;
  }
  const w = +(width * scale).toFixed(3);
  const h = +(height * scale).toFixed(3);

  let pdf;
  const flate = await deflate(rgb);
  if (!hasAlpha && (preferJpeg || flate.length > 400 * 1024)) {
    // Photos compress far better as JPEG.
    const jpeg = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
    const bytes = new Uint8Array(await jpeg.arrayBuffer());
    pdf = buildPdf(w, h, `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCII85Decode /DCTDecode]`, ascii85(bytes));
  } else {
    const smask = hasAlpha
      ? { dict: `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter [/ASCII85Decode /FlateDecode]`, data: ascii85(await deflate(alpha)) }
      : null;
    pdf = buildPdf(w, h, `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCII85Decode /FlateDecode]`, ascii85(flate), smask);
  }
  return pdf;
}

export async function imageToAsciiPdf(blob) {
  const { canvas, scale } = await loadImage(blob);
  return canvasToPdf(canvas, scale, blob.type === 'image/jpeg');
}

// Rasterises the first page of a (binary) PDF with pdf.js.
export async function pdfToAsciiPdf(blob) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  try {
    const page = await doc.getPage(1);
    const scale = 3;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, canvas, viewport }).promise;
    return canvasToPdf(canvas, 1 / scale, false);
  } finally {
    closeDocument(doc);
  }
}

// Returns true if a binary PDF is already pure 7-bit ASCII (e.g. produced by us).
export function isAsciiBytes(bytes) {
  for (let i = 0; i < bytes.length; i++) if (bytes[i] > 126 || (bytes[i] < 32 && bytes[i] !== 10 && bytes[i] !== 13 && bytes[i] !== 9)) return false;
  return true;
}
