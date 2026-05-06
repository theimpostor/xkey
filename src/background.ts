import {
  CAPTURE_VISIBLE_TWEET_MESSAGE,
  type CaptureVisibleTweetRequest,
  type CaptureVisibleTweetResponse,
  type Rect,
  type Viewport
} from "./messages";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isCaptureVisibleTweetRequest(message)) {
    return false;
  }

  void captureVisibleTweet(message, sender)
    .then((imageDataUrl) => {
      sendResponse({
        ok: true,
        imageDataUrl
      } satisfies CaptureVisibleTweetResponse);
    })
    .catch((error: unknown) => {
      sendResponse({
        ok: false,
        error: getErrorMessage(error)
      } satisfies CaptureVisibleTweetResponse);
    });

  return true;
});

async function captureVisibleTweet(
  request: CaptureVisibleTweetRequest,
  sender: chrome.runtime.MessageSender
): Promise<string> {
  const screenshotDataUrl = await chrome.tabs.captureVisibleTab(
    sender.tab?.windowId,
    {
      format: "png"
    }
  );

  return cropImageDataUrl(
    screenshotDataUrl,
    request.rect,
    request.viewport
  );
}

async function cropImageDataUrl(
  imageDataUrl: string,
  rect: Rect,
  viewport: Viewport
): Promise<string> {
  const sourceBlob = await dataUrlToBlob(imageDataUrl);
  const sourceImage = await createImageBitmap(sourceBlob);

  try {
    const cropRect = getPixelCropRect(
      rect,
      viewport,
      sourceImage.width,
      sourceImage.height
    );
    const canvas = new OffscreenCanvas(cropRect.width, cropRect.height);
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not create screenshot crop canvas.");
    }

    context.drawImage(
      sourceImage,
      cropRect.x,
      cropRect.y,
      cropRect.width,
      cropRect.height,
      0,
      0,
      cropRect.width,
      cropRect.height
    );

    const cropBlob = await canvas.convertToBlob({ type: "image/png" });
    return blobToDataUrl(cropBlob);
  } finally {
    sourceImage.close();
  }
}

function getPixelCropRect(
  rect: Rect,
  viewport: Viewport,
  imageWidth: number,
  imageHeight: number
): Rect {
  const scaleX = imageWidth / viewport.width;
  const scaleY = imageHeight / viewport.height;
  const x = Math.max(0, Math.floor(rect.x * scaleX));
  const y = Math.max(0, Math.floor(rect.y * scaleY));
  const right = Math.min(
    imageWidth,
    Math.ceil((rect.x + rect.width) * scaleX)
  );
  const bottom = Math.min(
    imageHeight,
    Math.ceil((rect.y + rect.height) * scaleY)
  );
  const width = right - x;
  const height = bottom - y;

  if (width <= 0 || height <= 0) {
    throw new Error("Selected tweet is outside the captured viewport.");
  }

  return {
    x,
    y,
    width,
    height
  };
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  return `data:${blob.type || "image/png"};base64,${base64}`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(index, index + chunkSize)
    );
  }

  return btoa(binary);
}

function isCaptureVisibleTweetRequest(
  message: unknown
): message is CaptureVisibleTweetRequest {
  return (
    isRecord(message) &&
    message["type"] === CAPTURE_VISIBLE_TWEET_MESSAGE &&
    isRect(message["rect"]) &&
    isViewport(message["viewport"])
  );
}

function isRect(value: unknown): value is Rect {
  return (
    isRecord(value) &&
    isFiniteNumber(value["x"]) &&
    isFiniteNumber(value["y"]) &&
    isFiniteNumber(value["width"]) &&
    isFiniteNumber(value["height"])
  );
}

function isViewport(value: unknown): value is Viewport {
  return (
    isRecord(value) &&
    isFiniteNumber(value["width"]) &&
    isFiniteNumber(value["height"]) &&
    value["width"] > 0 &&
    value["height"] > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
