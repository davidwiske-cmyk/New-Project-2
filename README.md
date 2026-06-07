# Virtual Try-On

A Chrome extension that uses AI to show you wearing clothes from any shopping page.

## Structure

```
backend/    — Next.js app, deploy to Vercel
extension/  — Chrome extension, load unpacked in Chrome
```

## Setup

### 1. Backend (Vercel)

1. Get a Replicate API key at [replicate.com](https://replicate.com)
2. Deploy the `backend/` folder to Vercel
3. Add `REPLICATE_API_KEY` as an environment variable in Vercel project settings
4. Note your deployed URL (e.g. `https://your-app.vercel.app`)

```bash
cd backend
npm install
npm run dev       # local testing
```

### 2. Chrome Extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `extension/` folder

### 3. Using it

1. Click the extension icon in your toolbar
2. Upload a photo of yourself
3. Paste your Vercel backend URL
4. Navigate to a product page (Zalando, Nike, ASOS, etc.)
5. Click **Try it on** — wait ~30 seconds
6. The product image is replaced with you wearing it
7. Click **Restore original** to undo

## Cost

~$0.05–0.15 per try-on via Replicate (IDM-VTON model).
