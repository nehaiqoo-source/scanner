const state = {
  pages: [],
  selectedId: null,
  stream: null,
  crop: null,
  dragging: null,
  settings: {
    pageSize: "a4",
    pdfQuality: 0.92,
    includeText: true
  }
};

const els = {
  fileInput: document.querySelector("#fileInput"),
  dropZone: document.querySelector("#dropZone"),
  cameraButton: document.querySelector("#cameraButton"),
  scanButton: document.querySelector("#scanButton"),
  cameraStage: document.querySelector("#cameraStage"),
  cameraFeed: document.querySelector("#cameraFeed"),
  pageList: document.querySelector("#pageList"),
  pageCount: document.querySelector("#pageCount"),
  clearButton: document.querySelector("#clearButton"),
  exportStatus: document.querySelector("#exportStatus"),
  emptyState: document.querySelector("#emptyState"),
  canvasWrap: document.querySelector("#canvasWrap"),
  canvas: document.querySelector("#pageCanvas"),
  cropBox: document.querySelector("#cropBox"),
  titleInput: document.querySelector("#titleInput"),
  documentTitle: document.querySelector("#documentTitle"),
  brightnessInput: document.querySelector("#brightnessInput"),
  contrastInput: document.querySelector("#contrastInput"),
  sharpnessInput: document.querySelector("#sharpnessInput"),
  autoEnhance: document.querySelector("#autoEnhance"),
  rotateLeft: document.querySelector("#rotateLeft"),
  rotateRight: document.querySelector("#rotateRight"),
  toggleCrop: document.querySelector("#toggleCrop"),
  applyCrop: document.querySelector("#applyCrop"),
  pageText: document.querySelector("#pageText"),
  ocrButton: document.querySelector("#ocrButton"),
  ocrStatus: document.querySelector("#ocrStatus"),
  pageSize: document.querySelector("#pageSize"),
  pdfQuality: document.querySelector("#pdfQuality"),
  includeText: document.querySelector("#includeText"),
  qualityLabel: document.querySelector("#qualityLabel"),
  toast: document.querySelector("#toast"),
  exportPdf: document.querySelector("#exportPdf"),
  exportDocx: document.querySelector("#exportDocx"),
  exportDoc: document.querySelector("#exportDoc"),
  exportHtml: document.querySelector("#exportHtml"),
  exportTxt: document.querySelector("#exportTxt"),
  exportJson: document.querySelector("#exportJson"),
  downloadAll: document.querySelector("#downloadAll")
};

const ctx = els.canvas.getContext("2d", { willReadFrequently: true });
let lastDownloadUrl = null;

function selectedPage() {
  return state.pages.find((page) => page.id === state.selectedId) || null;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function slugify(value) {
  return (value || "scanned-document")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "scanned-document";
}

function downloadBlob(blob, filename) {
  if (lastDownloadUrl) {
    URL.revokeObjectURL(lastDownloadUrl);
  }
  const url = URL.createObjectURL(blob);
  lastDownloadUrl = url;

  els.exportStatus.innerHTML = "";
  const link = document.createElement("a");
  link.className = "download-link";
  link.href = url;
  link.download = filename;
  link.innerHTML = `<span>${escapeHtml(filename)}</span><strong>Download</strong>`;
  els.exportStatus.append(link);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  showToast(`${filename} is ready`);
}

function setExportBusy(label) {
  els.exportStatus.textContent = label;
}

function setExportError(error) {
  console.error(error);
  els.exportStatus.textContent = "Export failed. Try another format or smaller pages.";
  showToast("Export failed");
}

async function runExport(label, task) {
  try {
    setExportBusy(`Preparing ${label}...`);
    await task();
  } catch (error) {
    setExportError(error);
  }
}

function activateTab(name) {
  document.querySelectorAll(".tab").forEach((tabButton) => {
    const isActive = tabButton.dataset.tab === name;
    tabButton.classList.toggle("active", isActive);
    tabButton.setAttribute("aria-selected", String(isActive));
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    const isActive = panel.id === `${name}Panel`;
    panel.classList.toggle("active", isActive);
    panel.hidden = !isActive;
  });
}

function requirePages() {
  if (state.pages.length) {
    return true;
  }
  els.exportStatus.textContent = "Add at least one scanned page before exporting.";
  showToast("Add at least one page first.");
  return false;
}

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function fileToPage(file) {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    showToast("PDF import is limited in this lightweight app. Export scanned images as PDF after adding image pages.");
    return null;
  }

  const source = await blobToDataUrl(file);
  const image = await loadImage(source);
  return createPageFromImage(image, file.name.replace(/\.[^.]+$/, "") || `Page ${state.pages.length + 1}`);
}

function createPageFromImage(image, name) {
  const sourceCanvas = document.createElement("canvas");
  const sourceCtx = sourceCanvas.getContext("2d");
  sourceCanvas.width = image.naturalWidth || image.videoWidth || image.width;
  sourceCanvas.height = image.naturalHeight || image.videoHeight || image.height;
  sourceCtx.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);

  return {
    id: makeId(),
    name,
    sourceDataUrl: sourceCanvas.toDataURL("image/jpeg", 0.96),
    renderedDataUrl: sourceCanvas.toDataURL("image/jpeg", 0.92),
    width: sourceCanvas.width,
    height: sourceCanvas.height,
    rotation: 0,
    filter: "grayscale",
    brightness: 8,
    contrast: 18,
    sharpness: 18,
    text: "",
    createdAt: new Date().toISOString()
  };
}

async function addPages(files) {
  const accepted = [...files].filter((file) => file.type.startsWith("image/") || file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
  if (!accepted.length) {
    showToast("Choose image files from camera or gallery.");
    return;
  }

  for (const file of accepted) {
    const page = await fileToPage(file);
    if (page) {
      state.pages.push(page);
      state.selectedId = page.id;
      await renderSelectedPage();
    }
  }

  updatePageList();
  showToast(`${accepted.length} file${accepted.length === 1 ? "" : "s"} added`);
}

function updatePageList() {
  els.pageCount.textContent = `${state.pages.length} page${state.pages.length === 1 ? "" : "s"}`;
  els.pageList.innerHTML = "";

  state.pages.forEach((page, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `page-item${page.id === state.selectedId ? " active" : ""}`;
    item.dataset.id = page.id;
    item.innerHTML = `
      <img class="page-thumb" alt="Page ${index + 1} thumbnail" src="${page.renderedDataUrl}" />
      <span class="page-meta">
        <strong>Page ${index + 1}</strong>
        <span>${page.width} × ${page.height}</span>
      </span>
      <span class="icon-button" aria-hidden="true">›</span>
    `;
    item.addEventListener("click", () => selectPage(page.id));
    els.pageList.append(item);
  });

  const hasPages = state.pages.length > 0;
  els.emptyState.hidden = hasPages;
  els.canvasWrap.hidden = !hasPages;
}

async function selectPage(id) {
  const current = selectedPage();
  if (current) {
    current.text = els.pageText.value;
  }
  state.selectedId = id;
  state.crop = null;
  await renderSelectedPage();
  updatePageList();
}

function syncControls(page) {
  if (!page) return;
  els.brightnessInput.value = page.brightness;
  els.contrastInput.value = page.contrast;
  els.sharpnessInput.value = page.sharpness;
  els.pageText.value = page.text || "";

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === page.filter);
  });
}

async function renderSelectedPage() {
  const page = selectedPage();
  if (!page) {
    updatePageList();
    return;
  }

  syncControls(page);
  const rendered = await renderPageToCanvas(page);
  page.renderedDataUrl = rendered.toDataURL("image/jpeg", Number(state.settings.pdfQuality));
  els.canvas.width = rendered.width;
  els.canvas.height = rendered.height;
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  ctx.drawImage(rendered, 0, 0);
  updateCropBox();
  updatePageList();
}

async function renderPageToCanvas(page, options = {}) {
  const image = await loadImage(page.sourceDataUrl);
  const rotated = document.createElement("canvas");
  const rotatedCtx = rotated.getContext("2d", { willReadFrequently: true });
  const swap = Math.abs(page.rotation % 180) === 90;
  rotated.width = swap ? image.height : image.width;
  rotated.height = swap ? image.width : image.height;

  rotatedCtx.save();
  rotatedCtx.translate(rotated.width / 2, rotated.height / 2);
  rotatedCtx.rotate((page.rotation * Math.PI) / 180);
  rotatedCtx.drawImage(image, -image.width / 2, -image.height / 2);
  rotatedCtx.restore();

  let imageData = rotatedCtx.getImageData(0, 0, rotated.width, rotated.height);
  imageData = adjustImageData(imageData, page);
  rotatedCtx.putImageData(imageData, 0, 0);

  if (page.sharpness > 0 && page.filter !== "bw") {
    applySharpen(rotatedCtx, rotated.width, rotated.height, page.sharpness / 100);
  }

  if (options.maxWidth && rotated.width > options.maxWidth) {
    const scaled = document.createElement("canvas");
    const scaledCtx = scaled.getContext("2d");
    const ratio = options.maxWidth / rotated.width;
    scaled.width = Math.round(rotated.width * ratio);
    scaled.height = Math.round(rotated.height * ratio);
    scaledCtx.drawImage(rotated, 0, 0, scaled.width, scaled.height);
    return scaled;
  }

  return rotated;
}

function adjustImageData(imageData, page) {
  const data = imageData.data;
  const brightness = Number(page.brightness) || 0;
  const contrastValue = Number(page.contrast) || 0;
  const factor = (259 * (contrastValue + 255)) / (255 * (259 - contrastValue));

  for (let index = 0; index < data.length; index += 4) {
    let red = factor * (data[index] - 128) + 128 + brightness;
    let green = factor * (data[index + 1] - 128) + 128 + brightness;
    let blue = factor * (data[index + 2] - 128) + 128 + brightness;

    if (page.filter === "grayscale" || page.filter === "bw") {
      const gray = red * 0.299 + green * 0.587 + blue * 0.114;
      red = gray;
      green = gray;
      blue = gray;
    }

    if (page.filter === "bw") {
      const threshold = 154 - brightness * 0.25;
      const value = red > threshold ? 255 : 0;
      red = value;
      green = value;
      blue = value;
    }

    data[index] = Math.max(0, Math.min(255, red));
    data[index + 1] = Math.max(0, Math.min(255, green));
    data[index + 2] = Math.max(0, Math.min(255, blue));
  }

  return imageData;
}

function applySharpen(context, width, height, amount) {
  const src = context.getImageData(0, 0, width, height);
  const output = context.createImageData(width, height);
  const data = src.data;
  const out = output.data;
  out.set(data);
  const center = 1 + 4 * amount;
  const side = -amount;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const value =
          data[offset + channel] * center +
          data[offset - 4 + channel] * side +
          data[offset + 4 + channel] * side +
          data[offset - width * 4 + channel] * side +
          data[offset + width * 4 + channel] * side;
        out[offset + channel] = Math.max(0, Math.min(255, value));
      }
      out[offset + 3] = data[offset + 3];
    }
  }

  context.putImageData(output, 0, 0);
}

function setPagePatch(patch) {
  const page = selectedPage();
  if (!page) return;
  Object.assign(page, patch);
  renderSelectedPage();
}

async function startCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
    els.cameraStage.hidden = true;
    els.cameraButton.innerHTML = '<span aria-hidden="true">◉</span> Camera';
    els.scanButton.disabled = true;
    return;
  }

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    });
    els.cameraFeed.srcObject = state.stream;
    els.cameraStage.hidden = false;
    els.scanButton.disabled = false;
    els.cameraButton.innerHTML = '<span aria-hidden="true">■</span> Stop';
  } catch {
    showToast("Camera permission was blocked or is unavailable.");
  }
}

async function captureFrame() {
  if (!state.stream) return;
  const video = els.cameraFeed;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  const image = await loadImage(canvas.toDataURL("image/jpeg", 0.96));
  const page = createPageFromImage(image, `Camera page ${state.pages.length + 1}`);
  state.pages.push(page);
  state.selectedId = page.id;
  await renderSelectedPage();
  showToast("Page scanned");
}

function updateCropBox() {
  if (!state.crop) {
    els.cropBox.hidden = true;
    return;
  }
  const canvasRect = els.canvas.getBoundingClientRect();
  const scaleX = canvasRect.width / els.canvas.width;
  const scaleY = canvasRect.height / els.canvas.height;
  els.cropBox.hidden = false;
  els.cropBox.style.left = `${state.crop.x * scaleX}px`;
  els.cropBox.style.top = `${state.crop.y * scaleY}px`;
  els.cropBox.style.width = `${state.crop.width * scaleX}px`;
  els.cropBox.style.height = `${state.crop.height * scaleY}px`;
}

function initCrop() {
  if (!selectedPage()) return;
  const marginX = Math.round(els.canvas.width * 0.08);
  const marginY = Math.round(els.canvas.height * 0.08);
  state.crop = {
    x: marginX,
    y: marginY,
    width: els.canvas.width - marginX * 2,
    height: els.canvas.height - marginY * 2
  };
  updateCropBox();
}

async function applyCrop() {
  const page = selectedPage();
  if (!page || !state.crop) return;
  const source = await renderPageToCanvas(page);
  const crop = clampCrop(state.crop, source.width, source.height);
  const cropped = document.createElement("canvas");
  cropped.width = crop.width;
  cropped.height = crop.height;
  cropped.getContext("2d").drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);

  page.sourceDataUrl = cropped.toDataURL("image/jpeg", 0.96);
  page.width = cropped.width;
  page.height = cropped.height;
  page.rotation = 0;
  page.brightness = 0;
  page.contrast = 0;
  page.sharpness = 12;
  state.crop = null;
  await renderSelectedPage();
  showToast("Crop applied");
}

function clampCrop(crop, width, height) {
  const minSize = 40;
  const x = Math.max(0, Math.min(width - minSize, crop.x));
  const y = Math.max(0, Math.min(height - minSize, crop.y));
  return {
    x,
    y,
    width: Math.max(minSize, Math.min(width - x, crop.width)),
    height: Math.max(minSize, Math.min(height - y, crop.height))
  };
}

function canvasPoint(event) {
  const canvasRect = els.canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - canvasRect.left) / canvasRect.width) * els.canvas.width,
    y: ((event.clientY - canvasRect.top) / canvasRect.height) * els.canvas.height
  };
}

function cropPointerDown(event) {
  if (!state.crop) return;
  const corner = event.target.dataset.corner || "move";
  state.dragging = {
    corner,
    start: canvasPoint(event),
    crop: { ...state.crop }
  };
  els.cropBox.setPointerCapture(event.pointerId);
}

function cropPointerMove(event) {
  if (!state.dragging || !state.crop) return;
  const point = canvasPoint(event);
  const dx = point.x - state.dragging.start.x;
  const dy = point.y - state.dragging.start.y;
  const base = state.dragging.crop;
  let next = { ...base };

  if (state.dragging.corner === "move") {
    next.x = base.x + dx;
    next.y = base.y + dy;
  }
  if (state.dragging.corner.includes("l")) {
    next.x = base.x + dx;
    next.width = base.width - dx;
  }
  if (state.dragging.corner.includes("r")) {
    next.width = base.width + dx;
  }
  if (state.dragging.corner.includes("t")) {
    next.y = base.y + dy;
    next.height = base.height - dy;
  }
  if (state.dragging.corner.includes("b")) {
    next.height = base.height + dy;
  }

  state.crop = clampCrop(next, els.canvas.width, els.canvas.height);
  updateCropBox();
}

function cropPointerUp(event) {
  if (state.dragging) {
    els.cropBox.releasePointerCapture(event.pointerId);
  }
  state.dragging = null;
}

async function detectText() {
  const page = selectedPage();
  if (!page) return;

  if ("TextDetector" in window) {
    try {
      els.ocrStatus.textContent = "Reading";
      const detector = new TextDetector();
      const results = await detector.detect(els.canvas);
      const text = results.map((result) => result.rawValue).join("\n");
      page.text = text;
      els.pageText.value = text;
      els.ocrStatus.textContent = "Done";
      showToast("Text detected");
      return;
    } catch {
      els.ocrStatus.textContent = "Unavailable";
    }
  }

  els.ocrStatus.textContent = "Manual";
  showToast("This browser does not expose OCR. Type or paste page text here for TXT/DOCX exports.");
}

function persistText() {
  const page = selectedPage();
  if (page) {
    page.text = els.pageText.value;
  }
}

async function pageCanvasesForExport(maxWidth = 1600) {
  persistText();
  const canvases = [];
  for (const page of state.pages) {
    canvases.push(await renderPageToCanvas(page, { maxWidth }));
  }
  return canvases;
}

function getPageDimensions(canvas) {
  if (state.settings.pageSize === "fit") {
    return { width: Math.round(canvas.width * 0.72), height: Math.round(canvas.height * 0.72) };
  }
  if (state.settings.pageSize === "letter") {
    return { width: 612, height: 792 };
  }
  return { width: 595, height: 842 };
}

function imagePlacement(canvas, pageSize) {
  const margin = state.settings.pageSize === "fit" ? 0 : 28;
  const maxWidth = pageSize.width - margin * 2;
  const maxHeight = pageSize.height - margin * 2;
  const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
  const width = canvas.width * scale;
  const height = canvas.height * scale;
  return {
    x: (pageSize.width - width) / 2,
    y: (pageSize.height - height) / 2,
    width,
    height
  };
}

async function exportPdf() {
  if (!requirePages()) return;
  const canvases = await pageCanvasesForExport();
  const pdfBytes = buildPdf(canvases);
  downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), `${slugify(els.titleInput.value)}.pdf`);
}

function buildPdf(canvases) {
  const encoder = new TextEncoder();
  const parts = [];
  const offsets = [0];
  let length = 0;
  const objects = [];

  function addRaw(value) {
    const bytes = value instanceof Uint8Array ? value : encoder.encode(value);
    parts.push(bytes);
    length += bytes.length;
  }

  function addObject(body) {
    objects.push(body);
    return objects.length;
  }

  const pagesRef = 2;
  addObject("<< /Type /Catalog /Pages 2 0 R >>");
  addObject("__PAGES__");

  const pageRefs = [];
  canvases.forEach((canvas) => {
    const pageSize = getPageDimensions(canvas);
    const placement = imagePlacement(canvas, pageSize);
    const imageData = dataUrlToBytes(canvas.toDataURL("image/jpeg", Number(state.settings.pdfQuality)));
    const imageRef = addObject(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageData.length} >>\nstream\n__STREAM_${objects.length + 1}__\nendstream`);
    objects[imageRef - 1] = { stream: imageData, header: `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageData.length} >>` };
    const content = `q\n${placement.width.toFixed(2)} 0 0 ${placement.height.toFixed(2)} ${placement.x.toFixed(2)} ${(pageSize.height - placement.y - placement.height).toFixed(2)} cm\n/Im${imageRef} Do\nQ`;
    const contentBytes = encoder.encode(content);
    const contentRef = addObject(`<< /Length ${contentBytes.length} >>\nstream\n${content}\nendstream`);
    const pageRef = addObject(`<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 ${pageSize.width} ${pageSize.height}] /Resources << /XObject << /Im${imageRef} ${imageRef} 0 R >> >> /Contents ${contentRef} 0 R >>`);
    pageRefs.push(pageRef);
  });

  objects[pagesRef - 1] = `<< /Type /Pages /Count ${pageRefs.length} /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] >>`;

  addRaw("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  objects.forEach((object, index) => {
    offsets.push(length);
    addRaw(`${index + 1} 0 obj\n`);
    if (object && object.stream) {
      addRaw(`${object.header}\nstream\n`);
      addRaw(object.stream);
      addRaw("\nendstream");
    } else {
      addRaw(object);
    }
    addRaw("\nendobj\n");
  });

  const xrefOffset = length;
  addRaw(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (let index = 1; index < offsets.length; index += 1) {
    addRaw(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  }
  addRaw(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const output = new Uint8Array(length);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

async function exportHtml(format = "html") {
  if (!requirePages()) return;
  persistText();
  const title = escapeHtml(els.titleInput.value || "Scanned document");
  const pageSections = state.pages.map((page, index) => `
    <section class="page">
      <h2>Page ${index + 1}</h2>
      <img src="${page.renderedDataUrl}" alt="Page ${index + 1}" />
      ${state.settings.includeText && page.text ? `<pre>${escapeHtml(page.text)}</pre>` : ""}
    </section>
  `).join("\n");
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
body{font-family:Arial,sans-serif;margin:32px;color:#18202a}
.page{page-break-after:always;margin:0 0 32px}
img{max-width:100%;height:auto;border:1px solid #ddd}
pre{white-space:pre-wrap;font:14px/1.5 Arial,sans-serif}
</style>
</head>
<body>
<h1>${title}</h1>
${pageSections}
</body>
</html>`;
  downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${slugify(title)}.${format}`);
}

function exportTxt() {
  if (!requirePages()) return;
  persistText();
  const text = state.pages.map((page, index) => `Page ${index + 1}\n${page.text || ""}`).join("\n\n---\n\n");
  downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), `${slugify(els.titleInput.value)}.txt`);
}

function exportJson() {
  if (!requirePages()) return;
  persistText();
  const payload = {
    title: els.titleInput.value,
    exportedAt: new Date().toISOString(),
    pages: state.pages.map((page, index) => ({
      page: index + 1,
      width: page.width,
      height: page.height,
      filter: page.filter,
      text: page.text,
      image: page.renderedDataUrl
    }))
  };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `${slugify(els.titleInput.value)}.json`);
}

async function exportDocx() {
  if (!requirePages()) return;
  persistText();
  const canvases = await pageCanvasesForExport(1200);
  const files = buildDocxFiles(canvases);
  const zipBytes = buildZip(files);
  downloadBlob(new Blob([zipBytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), `${slugify(els.titleInput.value)}.docx`);
}

function buildDocxFiles(canvases) {
  const title = escapeXml(els.titleInput.value || "Scanned document");
  const relationships = [];
  const body = [`<w:p><w:r><w:t>${title}</w:t></w:r></w:p>`];
  const files = [
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdOfficeDoc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    }
  ];

  canvases.forEach((canvas, index) => {
    const relId = `rId${index + 1}`;
    const imageName = `media/page-${index + 1}.jpg`;
    const imageBytes = dataUrlToBytes(canvas.toDataURL("image/jpeg", Number(state.settings.pdfQuality)));
    const widthEmu = Math.min(5486400, Math.round(canvas.width * 6350));
    const heightEmu = Math.round(widthEmu * (canvas.height / canvas.width));

    files.push({ name: `word/${imageName}`, data: imageBytes });
    relationships.push(`<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${imageName}"/>`);
    body.push(`<w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${widthEmu}" cy="${heightEmu}"/><wp:docPr id="${index + 1}" name="Page ${index + 1}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${index + 1}" name="Page ${index + 1}.jpg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`);
    if (state.settings.includeText && state.pages[index].text) {
      body.push(`<w:p><w:r><w:t>${escapeXml(state.pages[index].text)}</w:t></w:r></w:p>`);
    }
    body.push(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`);
  });

  files.push({
    name: "word/_rels/document.xml.rels",
    data: `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${relationships.join("\n")}
</Relationships>`
  });
  files.push({
    name: "word/document.xml",
    data: `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${body.join("\n")}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>
  </w:body>
</w:document>`
  });

  return files;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  function uint16(value) {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, value, true);
    return bytes;
  }

  function uint32(value) {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value, true);
    return bytes;
  }

  function normalizeData(data) {
    return data instanceof Uint8Array ? data : encoder.encode(data);
  }

  files.forEach((file) => {
    const name = encoder.encode(file.name);
    const data = normalizeData(file.data);
    const crc = crc32(data);
    const localHeader = concatBytes([
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(data.length),
      uint32(data.length),
      uint16(name.length),
      uint16(0),
      name
    ]);
    localParts.push(localHeader, data);

    const centralHeader = concatBytes([
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(data.length),
      uint32(data.length),
      uint16(name.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(offset),
      name
    ]);
    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  });

  const centralDirectory = concatBytes(centralParts);
  const end = concatBytes([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(files.length),
    uint16(files.length),
    uint32(centralDirectory.length),
    uint32(offset),
    uint16(0)
  ]);

  return concatBytes([...localParts, centralDirectory, end]);
}

function concatBytes(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function bindEvents() {
  els.fileInput.addEventListener("change", (event) => addPages(event.target.files));
  els.dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    els.dropZone.classList.add("drag-over");
  });
  els.dropZone.addEventListener("dragleave", () => els.dropZone.classList.remove("drag-over"));
  els.dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    els.dropZone.classList.remove("drag-over");
    addPages(event.dataTransfer.files);
  });

  els.cameraButton.addEventListener("click", startCamera);
  els.scanButton.addEventListener("click", captureFrame);
  els.clearButton.addEventListener("click", () => {
    state.pages = [];
    state.selectedId = null;
    state.crop = null;
    updatePageList();
    showToast("Pages cleared");
  });

  els.titleInput.addEventListener("input", () => {
    els.documentTitle.textContent = els.titleInput.value || "Untitled document";
  });

  [els.brightnessInput, els.contrastInput, els.sharpnessInput].forEach((input) => {
    input.addEventListener("input", () => {
      const page = selectedPage();
      if (!page) return;
      page.brightness = Number(els.brightnessInput.value);
      page.contrast = Number(els.contrastInput.value);
      page.sharpness = Number(els.sharpnessInput.value);
      renderSelectedPage();
    });
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => setPagePatch({ filter: button.dataset.filter }));
  });

  document.querySelector("#editorTabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-tab]");
    if (button) {
      activateTab(button.dataset.tab);
    }
  });

  els.autoEnhance.addEventListener("click", () => setPagePatch({ filter: "grayscale", brightness: 10, contrast: 28, sharpness: 26 }));
  els.rotateLeft.addEventListener("click", () => {
    const page = selectedPage();
    if (page) setPagePatch({ rotation: (page.rotation - 90 + 360) % 360 });
  });
  els.rotateRight.addEventListener("click", () => {
    const page = selectedPage();
    if (page) setPagePatch({ rotation: (page.rotation + 90) % 360 });
  });
  els.toggleCrop.addEventListener("click", () => {
    if (state.crop) {
      state.crop = null;
    } else {
      initCrop();
    }
    updateCropBox();
  });
  els.applyCrop.addEventListener("click", applyCrop);
  els.cropBox.addEventListener("pointerdown", cropPointerDown);
  els.cropBox.addEventListener("pointermove", cropPointerMove);
  els.cropBox.addEventListener("pointerup", cropPointerUp);
  window.addEventListener("resize", updateCropBox);

  els.pageText.addEventListener("input", persistText);
  els.ocrButton.addEventListener("click", detectText);

  els.pageSize.addEventListener("change", () => {
    state.settings.pageSize = els.pageSize.value;
    els.qualityLabel.textContent = `${els.pageSize.selectedOptions[0].text} PDF`;
  });
  els.pdfQuality.addEventListener("change", () => {
    state.settings.pdfQuality = Number(els.pdfQuality.value);
  });
  els.includeText.addEventListener("change", () => {
    state.settings.includeText = els.includeText.checked;
  });

  els.exportPdf.addEventListener("click", () => runExport("PDF", exportPdf));
  els.downloadAll.addEventListener("click", () => runExport("PDF", exportPdf));
  els.exportDocx.addEventListener("click", () => runExport("DOCX", exportDocx));
  els.exportDoc.addEventListener("click", () => runExport("DOC", () => exportHtml("doc")));
  els.exportHtml.addEventListener("click", () => runExport("HTML", () => exportHtml("html")));
  els.exportTxt.addEventListener("click", () => runExport("TXT", exportTxt));
  els.exportJson.addEventListener("click", () => runExport("JSON", exportJson));
}

bindEvents();
updatePageList();
