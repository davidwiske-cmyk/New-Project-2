// ── State ──────────────────────────────────────────────────────────────────
let userPhoto = null;           // base64 data URL
let selectedImageUrl = null;    // product image base64 or URL
let selectedCategory = "auto";
let currentGarmentLabel = "";
let currentOriginalImage = null;
let originalProductWidth = null;
let originalProductHeight = null;

// ── DOM refs ───────────────────────────────────────────────────────────────
const screens = {
  main: document.getElementById("screen-main"),
  crop: document.getElementById("screen-crop"),
  history: document.getElementById("screen-history"),
  result: document.getElementById("screen-result"),
};

const photoArea        = document.getElementById("photoArea");
const photoInput       = document.getElementById("photoInput");
const photoPreview     = document.getElementById("photoPreview");
const photoPlaceholder = document.getElementById("photoPlaceholder");
const editPhotoBtn     = document.getElementById("editPhotoBtn");
const productPreview   = document.getElementById("productPreview");
const productPlaceholder = document.getElementById("productPlaceholder");
const productArea      = document.getElementById("productArea");
const backendUrlInput  = document.getElementById("backendUrl");
const tryOnBtn         = document.getElementById("tryOnBtn");
const statusEl         = document.getElementById("status");
const progressArea     = document.getElementById("progressArea");
const progressBar      = document.getElementById("progressBar");
const progressLabel    = document.getElementById("progressLabel");
const selectImageBtn   = document.getElementById("selectImageBtn");
const historyBtn       = document.getElementById("historyBtn");
const historyList      = document.getElementById("historyList");
const onboarding       = document.getElementById("onboarding");

// ── Init ───────────────────────────────────────────────────────────────────
chrome.storage.local.get(["userPhoto", "backendUrl", "selectedCategory", "hasSeenOnboarding", "pendingProductImage"], (data) => {
  if (data.userPhoto) {
    userPhoto = data.userPhoto;
    showPhotoPreview(data.userPhoto);
  }
  if (data.backendUrl) backendUrlInput.value = data.backendUrl;
  if (data.selectedCategory) {
    selectedCategory = data.selectedCategory;
    updateCategoryUI();
  }
  if (!data.hasSeenOnboarding) showOnboarding();

  // Pick up product image selected while popup was closed
  if (data.pendingProductImage) {
    const p = data.pendingProductImage;
    selectedImageUrl = p.imageUrl;
    currentGarmentLabel = p.label || "Garment";
    originalProductWidth = p.originalWidth || null;
    originalProductHeight = p.originalHeight || null;
    showProductPreview(selectedImageUrl);
    chrome.storage.local.remove("pendingProductImage");
  }

  updateTryOnBtn();
});

// ── Navigation ─────────────────────────────────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.add("hidden"));
  screens[name].classList.remove("hidden");
}

document.querySelectorAll(".back-btn").forEach((btn) => {
  btn.addEventListener("click", () => showScreen(btn.dataset.target));
});

// ── Onboarding ─────────────────────────────────────────────────────────────
let onboardingStep = 1;

function showOnboarding() {
  onboarding.classList.remove("hidden");
}

document.getElementById("onboardingNext").addEventListener("click", () => {
  if (onboardingStep < 3) {
    document.querySelector(`.onboarding-step[data-step="${onboardingStep}"]`).classList.remove("active");
    document.querySelector(`.dot:nth-child(${onboardingStep})`).classList.remove("active");
    onboardingStep++;
    document.querySelector(`.onboarding-step[data-step="${onboardingStep}"]`).classList.add("active");
    document.querySelector(`.dot:nth-child(${onboardingStep})`).classList.add("active");
    if (onboardingStep === 3) document.getElementById("onboardingNext").textContent = "Let's go!";
  } else {
    onboarding.classList.add("hidden");
    chrome.storage.local.set({ hasSeenOnboarding: true });
  }
});

// ── Photo upload ───────────────────────────────────────────────────────────
photoArea.addEventListener("click", () => photoInput.click());

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    openCropScreen(dataUrl);
  };
  reader.readAsDataURL(file);
});

editPhotoBtn.addEventListener("click", () => {
  if (userPhoto) openCropScreen(userPhoto);
});

function showPhotoPreview(dataUrl) {
  photoPreview.src = dataUrl;
  photoPreview.classList.remove("hidden");
  photoPlaceholder.classList.add("hidden");
  editPhotoBtn.classList.remove("hidden");
}

function showProductPreview(url) {
  productPreview.src = url;
  productPreview.classList.remove("hidden");
  productPlaceholder.classList.add("hidden");
}

// ── Crop ───────────────────────────────────────────────────────────────────
const cropImage   = document.getElementById("cropImage");
const zoomSlider  = document.getElementById("zoomSlider");
const cropConfirm = document.getElementById("cropConfirm");

let cropZoom = 1;
let cropX = 0, cropY = 0;
let dragStart = null;

function openCropScreen(dataUrl) {
  cropImage.src = dataUrl;
  cropX = 0; cropY = 0;

  // Auto-fit image to container on load
  cropImage.onload = () => {
    const container = document.querySelector(".crop-container");
    const cw = container.offsetWidth;
    const ch = container.offsetHeight;
    const iw = cropImage.naturalWidth;
    const ih = cropImage.naturalHeight;
    // Scale to fit the container (cover style)
    cropZoom = Math.max(cw / iw, ch / ih);
    // Clamp zoom slider range to accommodate auto-fit value
    zoomSlider.min = cropZoom;
    zoomSlider.max = cropZoom * 3;
    zoomSlider.step = cropZoom * 0.05;
    zoomSlider.value = cropZoom;
    applyCropTransform();
  };

  showScreen("crop");
}

function applyCropTransform() {
  cropImage.style.transform = `translate(${cropX}px, ${cropY}px) scale(${cropZoom})`;
}

zoomSlider.addEventListener("input", () => {
  cropZoom = parseFloat(zoomSlider.value);
  applyCropTransform();
});

cropImage.addEventListener("mousedown", (e) => {
  dragStart = { x: e.clientX - cropX, y: e.clientY - cropY };
  e.preventDefault();
});
document.addEventListener("mousemove", (e) => {
  if (!dragStart) return;
  cropX = e.clientX - dragStart.x;
  cropY = e.clientY - dragStart.y;
  applyCropTransform();
});
document.addEventListener("mouseup", () => { dragStart = null; });

cropConfirm.addEventListener("click", () => {
  const canvas = document.getElementById("cropCanvas");
  const container = document.querySelector(".crop-container");
  const w = container.offsetWidth;
  const h = container.offsetHeight;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2 + cropX, h / 2 + cropY);
    ctx.scale(cropZoom, cropZoom);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();

    const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.92);
    userPhoto = croppedDataUrl;
    chrome.storage.local.set({ userPhoto: croppedDataUrl });
    showPhotoPreview(croppedDataUrl);
    updateTryOnBtn();
    showScreen("main");
  };
  img.src = cropImage.src;
});

// ── Category picker ────────────────────────────────────────────────────────
document.querySelectorAll(".cat-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedCategory = btn.dataset.cat;
    chrome.storage.local.set({ selectedCategory });
    updateCategoryUI();
  });
});

function updateCategoryUI() {
  document.querySelectorAll(".cat-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.cat === selectedCategory);
  });
}

// ── Select product image ───────────────────────────────────────────────────
selectImageBtn.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { type: "ENTER_SELECTION_MODE" });
    window.close(); // close popup so user can interact with page
  });
});

// ── Backend URL ────────────────────────────────────────────────────────────
backendUrlInput.addEventListener("input", () => {
  chrome.storage.local.set({ backendUrl: backendUrlInput.value.trim() });
  updateTryOnBtn();
});

// ── Try it on ─────────────────────────────────────────────────────────────
tryOnBtn.addEventListener("click", async () => {
  if (!userPhoto || !selectedImageUrl || !backendUrlInput.value) return;

  setLoading(true);
  startProgress();
  hideStatus();

  chrome.storage.local.get(["backendUrl"], async (data) => {
    try {
      const res = await fetch(`${data.backendUrl.replace(/\/$/, "")}/api/tryon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          humanImage: userPhoto,
          garmentImage: selectedImageUrl,
          category: selectedCategory,
          garmentDescription: currentGarmentLabel,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.output) {
        throw new Error(json.error || "Something went wrong. Please try again.");
      }

      finishProgress();
      currentOriginalImage = selectedImageUrl;

      // Resize result to match original product image aspect ratio
      const finalResult = await resizeToMatch(
        json.output,
        originalProductWidth,
        originalProductHeight
      );

      // Save to history
      saveToHistory({
        label: currentGarmentLabel,
        garmentImage: selectedImageUrl,
        resultImage: finalResult,
        category: selectedCategory,
      });

      // Show result screen
      showResult(selectedImageUrl, finalResult, currentGarmentLabel);

      // Also swap on the page
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: "SWAP_IMAGE", resultUrl: finalResult });
      });

    } catch (err) {
      stopProgress();
      setStatus("error", err.message);
    } finally {
      setLoading(false);
    }
  });
});

// ── Progress bar ───────────────────────────────────────────────────────────
const progressSteps = [
  { pct: 10, label: "Analyzing garment...", delay: 1000 },
  { pct: 30, label: "Understanding your body shape...", delay: 5000 },
  { pct: 55, label: "Placing garment on you...", delay: 12000 },
  { pct: 75, label: "Refining fit and details...", delay: 22000 },
  { pct: 90, label: "Almost there...", delay: 32000 },
];

let progressTimers = [];

function startProgress() {
  progressArea.classList.remove("hidden");
  progressBar.style.width = "0%";
  progressLabel.textContent = "Starting...";

  progressSteps.forEach(({ pct, label, delay }) => {
    const t = setTimeout(() => {
      progressBar.style.width = `${pct}%`;
      progressLabel.textContent = label;
    }, delay);
    progressTimers.push(t);
  });
}

function finishProgress() {
  progressTimers.forEach(clearTimeout);
  progressBar.style.width = "100%";
  progressLabel.textContent = "Done!";
  setTimeout(() => progressArea.classList.add("hidden"), 1500);
}

function stopProgress() {
  progressTimers.forEach(clearTimeout);
  progressTimers = [];
  progressArea.classList.add("hidden");
  progressBar.style.width = "0%";
}

// ── Result screen ──────────────────────────────────────────────────────────
function showResult(originalUrl, resultUrl, label) {
  document.getElementById("resultOriginal").src = originalUrl;
  document.getElementById("resultOutput").src = resultUrl;
  document.getElementById("resultLabel").textContent = label;
  document.getElementById("resultTitle").textContent = label || "Result";
  showScreen("result");
}

document.getElementById("downloadBtn").addEventListener("click", () => {
  const url = document.getElementById("resultOutput").src;
  const a = document.createElement("a");
  a.href = url;
  a.download = `fitcheck-${Date.now()}.png`;
  a.click();
});

document.getElementById("tryAgainBtn").addEventListener("click", () => {
  showScreen("main");
});

// ── History ────────────────────────────────────────────────────────────────
historyBtn.addEventListener("click", () => {
  renderHistory();
  showScreen("history");
});

function saveToHistory(item) {
  chrome.storage.local.get(["history"], (data) => {
    const history = data.history || [];
    history.unshift({
      id: Date.now(),
      label: item.label || "Try-on",
      garmentImage: item.garmentImage,
      resultImage: item.resultImage,
      category: item.category,
      date: new Date().toLocaleDateString(),
    });
    // Keep last 20
    chrome.storage.local.set({ history: history.slice(0, 20) });
  });
}

function renderHistory() {
  chrome.storage.local.get(["history"], (data) => {
    const history = data.history || [];
    if (history.length === 0) {
      historyList.innerHTML = '<p class="empty-state">No fitchecks yet. Start by uploading a photo!</p>';
      return;
    }

    historyList.innerHTML = "";
    history.forEach((item) => {
      const el = document.createElement("div");
      el.className = "history-item";
      el.innerHTML = `
        <img class="history-thumb" src="${item.resultImage}" alt="${item.label}" />
        <div class="history-info">
          <div class="history-label">${item.label}</div>
          <div class="history-date">${item.date} · ${item.category}</div>
        </div>
        <button class="history-delete" data-id="${item.id}" title="Delete">×</button>
      `;
      el.addEventListener("click", (e) => {
        if (e.target.classList.contains("history-delete")) return;
        showResult(item.garmentImage, item.resultImage, item.label);
      });
      el.querySelector(".history-delete").addEventListener("click", () => {
        deleteHistoryItem(item.id);
      });
      historyList.appendChild(el);
    });
  });
}

function deleteHistoryItem(id) {
  chrome.storage.local.get(["history"], (data) => {
    const history = (data.history || []).filter((h) => h.id !== id);
    chrome.storage.local.set({ history }, () => renderHistory());
  });
}

// ── Resize result to match original product dimensions ─────────────────────
function resizeToMatch(resultUrl, targetW, targetH) {
  return new Promise((resolve) => {
    // If we don't have target dimensions, return as-is
    if (!targetW || !targetH) {
      resolve(resultUrl);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");

      // Cover: scale result to fill target dimensions, centered
      const scale = Math.max(targetW / img.width, targetH / img.height);
      const scaledW = img.width * scale;
      const scaledH = img.height * scale;
      const offsetX = (targetW - scaledW) / 2;
      const offsetY = (targetH - scaledH) / 2;

      ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(resultUrl); // fallback on error
    img.src = resultUrl;
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────
function updateTryOnBtn() {
  tryOnBtn.disabled = !(userPhoto && selectedImageUrl && backendUrlInput.value.trim());
}

function setLoading(on) {
  tryOnBtn.disabled = on;
  tryOnBtn.classList.toggle("loading", on);
  tryOnBtn.textContent = on ? "Processing..." : "Fitcheck";
}

function setStatus(type, msg) {
  statusEl.className = `status ${type}`;
  statusEl.textContent = msg;
  statusEl.classList.remove("hidden");
}

function hideStatus() {
  statusEl.classList.add("hidden");
}
