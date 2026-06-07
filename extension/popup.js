const photoArea = document.getElementById("photoArea");
const photoInput = document.getElementById("photoInput");
const photoPreview = document.getElementById("photoPreview");
const photoPlaceholder = document.getElementById("photoPlaceholder");
const backendUrlInput = document.getElementById("backendUrl");
const tryOnBtn = document.getElementById("tryOnBtn");
const statusEl = document.getElementById("status");

// Load saved state
chrome.storage.local.get(["userPhoto", "backendUrl"], (data) => {
  if (data.userPhoto) {
    showPhotoPreview(data.userPhoto);
  }
  if (data.backendUrl) {
    backendUrlInput.value = data.backendUrl;
  }
  updateBtn();
});

photoArea.addEventListener("click", () => photoInput.click());

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    chrome.storage.local.set({ userPhoto: dataUrl });
    showPhotoPreview(dataUrl);
    updateBtn();
  };
  reader.readAsDataURL(file);
});

backendUrlInput.addEventListener("input", () => {
  chrome.storage.local.set({ backendUrl: backendUrlInput.value.trim() });
  updateBtn();
});

tryOnBtn.addEventListener("click", async () => {
  setStatus("info", "Finding product image on page...");
  setLoading(true);

  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tabId = tabs[0].id;

    // Ask content script for the product image URL
    chrome.tabs.sendMessage(tabId, { type: "GET_PRODUCT_IMAGE" }, async (response) => {
      if (chrome.runtime.lastError || !response?.imageUrl) {
        setStatus("error", "No product image found on this page. Make sure you're on a product page.");
        setLoading(false);
        return;
      }

      setStatus("info", "Sending to AI... this takes ~30 seconds");

      chrome.storage.local.get(["userPhoto", "backendUrl"], async (data) => {
        try {
          const res = await fetch(`${data.backendUrl.replace(/\/$/, "")}/api/tryon`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              humanImage: data.userPhoto,
              garmentImage: response.imageUrl,
              garmentDescription: response.garmentDescription || "",
            }),
          });

          const json = await res.json();

          if (!res.ok || !json.output) {
            throw new Error(json.error || "Unknown error from backend");
          }

          // Send result image to content script to swap on page
          const resultUrl = Array.isArray(json.output) ? json.output[0] : json.output;
          chrome.tabs.sendMessage(tabId, { type: "SWAP_IMAGE", resultUrl });
          setStatus("success", "Done! You can see yourself wearing it on the page.");
        } catch (err) {
          setStatus("error", err.message);
        } finally {
          setLoading(false);
        }
      });
    });
  });
});

function showPhotoPreview(dataUrl) {
  photoPreview.src = dataUrl;
  photoPreview.classList.remove("hidden");
  photoPlaceholder.classList.add("hidden");
}

function updateBtn() {
  chrome.storage.local.get(["userPhoto", "backendUrl"], (data) => {
    tryOnBtn.disabled = !(data.userPhoto && data.backendUrl);
  });
}

function setLoading(on) {
  tryOnBtn.disabled = on;
  tryOnBtn.classList.toggle("loading", on);
  tryOnBtn.textContent = on ? "Processing..." : "Try it on";
}

function setStatus(type, msg) {
  statusEl.className = `status ${type}`;
  statusEl.textContent = msg;
  statusEl.classList.remove("hidden");
}
