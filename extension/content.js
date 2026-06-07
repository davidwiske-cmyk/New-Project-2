let originalSrc = null;
let swappedImg = null;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GET_PRODUCT_IMAGE") {
    const result = findProductImage();
    sendResponse(result);
  }

  if (msg.type === "SWAP_IMAGE") {
    swapImage(msg.resultUrl);
  }
});

function findProductImage() {
  // 1. Try og:image meta tag
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage?.content) {
    const title = getPageTitle();
    return { imageUrl: ogImage.content, garmentDescription: title };
  }

  // 2. Find largest visible <img> on the page (likely the product hero image)
  const imgs = Array.from(document.querySelectorAll("img"));
  const candidates = imgs
    .map((img) => {
      const rect = img.getBoundingClientRect();
      const area = rect.width * rect.height;
      return { img, area, src: img.src };
    })
    .filter(({ img, area, src }) => {
      if (!src || !src.startsWith("http")) return false;
      if (area < 90000) return false; // smaller than ~300x300
      // Skip logos and icons
      const alt = (img.alt || "").toLowerCase();
      const src2 = src.toLowerCase();
      if (alt.includes("logo") || src2.includes("logo")) return false;
      if (img.closest("nav, header, footer")) return false;
      return true;
    })
    .sort((a, b) => b.area - a.area);

  if (candidates.length === 0) return null;

  const best = candidates[0];
  return {
    imageUrl: best.src,
    garmentDescription: getPageTitle(),
  };
}

function swapImage(resultUrl) {
  // Find the same image we identified and swap it
  const ogMeta = document.querySelector('meta[property="og:image"]');
  const ogSrc = ogMeta?.content;

  let target = null;

  if (ogSrc) {
    target = Array.from(document.querySelectorAll("img")).find((img) => img.src === ogSrc);
  }

  if (!target) {
    // Fall back: find largest img again
    const imgs = Array.from(document.querySelectorAll("img"));
    const candidates = imgs
      .filter((img) => {
        const rect = img.getBoundingClientRect();
        return rect.width * rect.height >= 90000 && img.src?.startsWith("http");
      })
      .sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return rb.width * rb.height - ra.width * ra.height;
      });
    target = candidates[0];
  }

  if (!target) return;

  // Store original so we can restore
  originalSrc = target.src;
  swappedImg = target;

  target.src = resultUrl;
  target.style.objectFit = "contain";

  // Add a small restore button
  addRestoreButton(target);
}

function addRestoreButton(img) {
  // Remove existing button if any
  document.getElementById("vto-restore-btn")?.remove();

  const btn = document.createElement("button");
  btn.id = "vto-restore-btn";
  btn.textContent = "Restore original";
  Object.assign(btn.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: "999999",
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

function getPageTitle() {
  return (
    document.querySelector("h1")?.textContent?.trim() ||
    document.title ||
    ""
  );
}
