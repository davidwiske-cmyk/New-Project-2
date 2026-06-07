// ── State ──────────────────────────────────────────────────────────────────
let selectionMode = false;
let hoveredImg = null;
let swappedImg = null;
let originalSrc = null;

// ── Message listener ───────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "ENTER_SELECTION_MODE") enterSelectionMode();
  if (msg.type === "SWAP_IMAGE") swapImage(msg.resultUrl);
});

// ── Image selection mode ───────────────────────────────────────────────────
function enterSelectionMode() {
  selectionMode = true;
  injectSelectionStyles();
  showSelectionBanner();

  document.addEventListener("mouseover", onImgHover);
  document.addEventListener("mouseout", onImgOut);
  document.addEventListener("click", onImgClick, true);
}

function exitSelectionMode() {
  selectionMode = false;
  document.removeEventListener("mouseover", onImgHover);
  document.removeEventListener("mouseout", onImgOut);
  document.removeEventListener("click", onImgClick, true);
  if (hoveredImg) {
    hoveredImg.classList.remove("vto-hovered");
    hoveredImg = null;
  }
  document.getElementById("vto-selection-banner")?.remove();
  document.getElementById("vto-selection-styles")?.remove();
}

function onImgHover(e) {
  const img = e.target.closest("img");
  if (!img || !isProductCandidate(img)) return;
  if (hoveredImg) hoveredImg.classList.remove("vto-hovered");
  hoveredImg = img;
  img.classList.add("vto-hovered");
}

function onImgOut(e) {
  const img = e.target.closest("img");
  if (img) img.classList.remove("vto-hovered");
}

function onImgClick(e) {
  if (!selectionMode) return;
  const img = e.target.closest("img");
  if (!img || !isProductCandidate(img)) return;

  e.preventDefault();
  e.stopPropagation();

  const imageUrl = img.src;
  const label = getPageTitle();
  const originalWidth = img.naturalWidth || img.width;
  const originalHeight = img.naturalHeight || img.height;

  // Visual feedback immediately
  img.classList.remove("vto-hovered");
  img.classList.add("vto-selected");
  setTimeout(() => img.classList.remove("vto-selected"), 1000);
  exitSelectionMode();
  showToast("⏳ Capturing image...");

  // Fetch image as base64 from within the browser (bypasses CDN restrictions)
  fetchImageAsBase64(imageUrl)
    .then((base64) => {
      chrome.storage.local.set({
        pendingProductImage: { imageUrl: base64, label, originalWidth, originalHeight },
      });
      showToast("✓ Product selected! Open Fitcheck to continue.");
    })
    .catch(() => {
      // Fall back to URL if fetch fails
      chrome.storage.local.set({
        pendingProductImage: { imageUrl, label, originalWidth, originalHeight },
      });
      showToast("✓ Product selected! Open Fitcheck to continue.");
    });
}

function isProductCandidate(img) {
  if (!img.src || !img.src.startsWith("http")) return false;
  const rect = img.getBoundingClientRect();
  if (rect.width < 80 || rect.height < 80) return false;
  if (img.closest("nav, header, footer")) return false;
  const src = img.src.toLowerCase();
  const alt = (img.alt || "").toLowerCase();
  if (alt.includes("logo") || src.includes("logo") || src.includes("icon")) return false;
  return true;
}

function injectSelectionStyles() {
  if (document.getElementById("vto-selection-styles")) return;
  const style = document.createElement("style");
  style.id = "vto-selection-styles";
  style.textContent = `
    .vto-hovered {
      outline: 3px solid #fff !important;
      outline-offset: 2px !important;
      cursor: crosshair !important;
      filter: brightness(1.1) !important;
      transition: outline 0.1s, filter 0.1s !important;
    }
    .vto-selected {
      outline: 3px solid #4ade80 !important;
      outline-offset: 2px !important;
    }
  `;
  document.head.appendChild(style);
}

function showSelectionBanner() {
  document.getElementById("vto-selection-banner")?.remove();
  const banner = document.createElement("div");
  banner.id = "vto-selection-banner";
  Object.assign(banner.style, {
    position: "fixed",
    top: "16px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "2147483647",
    background: "#0a0a0a",
    color: "#f0f0f0",
    border: "1.5px solid #333",
    borderRadius: "10px",
    padding: "10px 18px",
    fontSize: "13px",
    fontFamily: "-apple-system, sans-serif",
    boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    whiteSpace: "nowrap",
  });
  banner.innerHTML = `
    <span>👆 Click a product image to select it</span>
    <button id="vto-cancel-selection" style="
      background:#1a1a1a;border:1px solid #333;color:#888;
      border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;
    ">Cancel</button>
  `;
  document.body.appendChild(banner);
  document.getElementById("vto-cancel-selection").addEventListener("click", exitSelectionMode);
}

// ── Swap image on page ─────────────────────────────────────────────────────
function swapImage(resultUrl) {
  // Try to find the last selected/hovered image, or auto-detect
  let target = findBestProductImage();
  if (!target) return;

  originalSrc = target.src;
  swappedImg = target;
  target.src = resultUrl;
  target.style.objectFit = "contain";

  addRestoreButton(target);
}

function findBestProductImage() {
  const ogMeta = document.querySelector('meta[property="og:image"]');
  if (ogMeta?.content) {
    const match = Array.from(document.querySelectorAll("img")).find((i) => i.src === ogMeta.content);
    if (match) return match;
  }

  return Array.from(document.querySelectorAll("img"))
    .filter(isProductCandidate)
    .sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return rb.width * rb.height - ra.width * ra.height;
    })[0] || null;
}

function addRestoreButton(img) {
  document.getElementById("vto-restore-btn")?.remove();
  const btn = document.createElement("button");
  btn.id = "vto-restore-btn";
  btn.textContent = "Restore original";
  Object.assign(btn.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: "2147483647",
    background: "#0a0a0a",
    color: "#f0f0f0",
    border: "1.5px solid #333",
    borderRadius: "8px",
    padding: "8px 14px",
    fontSize: "13px",
    fontFamily: "-apple-system, sans-serif",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
  });
  btn.addEventListener("click", () => {
    if (swappedImg && originalSrc) {
      swappedImg.src = originalSrc;
      swappedImg.style.objectFit = "";
    }
    btn.remove();
  });
  document.body.appendChild(btn);
}

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(msg) {
  const toast = document.createElement("div");
  Object.assign(toast.style, {
    position: "fixed",
    bottom: "24px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "2147483647",
    background: "#0a0a0a",
    color: "#f0f0f0",
    border: "1px solid #333",
    borderRadius: "8px",
    padding: "10px 18px",
    fontSize: "13px",
    fontFamily: "-apple-system, sans-serif",
    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
    opacity: "1",
    transition: "opacity 0.5s",
  });
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = "0"; }, 2500);
  setTimeout(() => toast.remove(), 3100);
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getPageTitle() {
  return (
    document.querySelector("h1")?.textContent?.trim() ||
    document.title ||
    "Garment"
  );
}

function fetchImageAsBase64(url) {
  return fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error("Fetch failed");
      return res.blob();
    })
    .then((blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }));
}
