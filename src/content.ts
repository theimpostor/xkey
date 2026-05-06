import {
  CAPTURE_VISIBLE_TWEET_MESSAGE,
  type CaptureVisibleTweetRequest,
  type CaptureVisibleTweetResponse,
  type Rect,
} from "./messages";

const SHOW_MORE_KEY = "h";
const OPEN_REFERENCED_TWEET_KEY = "o";
const SCREENSHOT_TWEET_KEY = "s";
const TWEET_SELECTOR = 'article[data-testid="tweet"]';
const CLICKABLE_SELECTOR = [
  "a",
  "button",
  '[role="button"]',
  "[tabindex]",
  "[data-testid]",
].join(",");

const SHOW_MORE_RE = /^show more$/i;
const STATUS_PATH_RE = /^\/([^/]+)\/status\/(\d+)(\/.*)?$/;

document.addEventListener("keydown", handleKeydown, true);

function handleKeydown(event: KeyboardEvent): void {
  if (!isSupportedShortcut(event) || isEditableTarget(event.target)) {
    return;
  }

  const selectedTweet = findKeyboardSelectedTweet();
  if (!selectedTweet) {
    return;
  }

  if (isShowMoreShortcut(event)) {
    const control = findShowMoreControl(selectedTweet);
    if (!control) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    control.click();
    return;
  }

  if (isScreenshotTweetShortcut(event)) {
    const visibleTweetRect = getVisibleTweetRect(selectedTweet);
    if (!visibleTweetRect) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    void copyVisibleTweetScreenshot(visibleTweetRect).catch(
      reportShortcutError,
    );
    return;
  }

  const referencedTweetUrl = findReferencedTweetUrl(selectedTweet);
  if (!referencedTweetUrl) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  window.location.assign(referencedTweetUrl);
}

function isSupportedShortcut(event: KeyboardEvent): boolean {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
    return false;
  }

  return (
    isShowMoreShortcut(event) ||
    isOpenReferencedTweetShortcut(event) ||
    isScreenshotTweetShortcut(event)
  );
}

function isShowMoreShortcut(event: KeyboardEvent): boolean {
  return !event.shiftKey && event.key.toLowerCase() === SHOW_MORE_KEY;
}

function isOpenReferencedTweetShortcut(event: KeyboardEvent): boolean {
  return (
    event.shiftKey && event.key.toLowerCase() === OPEN_REFERENCED_TWEET_KEY
  );
}

function isScreenshotTweetShortcut(event: KeyboardEvent): boolean {
  return event.shiftKey && event.key.toLowerCase() === SCREENSHOT_TWEET_KEY;
}

async function copyVisibleTweetScreenshot(rect: Rect): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error(
      "Image clipboard writes are not supported in this browser.",
    );
  }

  const request: CaptureVisibleTweetRequest = {
    type: CAPTURE_VISIBLE_TWEET_MESSAGE,
    rect,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  };
  const response = (await chrome.runtime.sendMessage(request)) as
    | CaptureVisibleTweetResponse
    | undefined;

  if (!response) {
    throw new Error("No screenshot response received from the extension.");
  }

  if (!response.ok) {
    throw new Error(response.error);
  }

  const imageBlob = await dataUrlToBlob(response.imageDataUrl);
  await navigator.clipboard.write([
    new ClipboardItem({
      [imageBlob.type || "image/png"]: imageBlob,
    }),
  ]);
}

function getVisibleTweetRect(tweet: Element): Rect | null {
  const rect = tweet.getBoundingClientRect();
  const left = clamp(rect.left, 0, window.innerWidth);
  const top = clamp(rect.top, 0, window.innerHeight);
  const right = clamp(rect.right, 0, window.innerWidth);
  const bottom = clamp(rect.bottom, 0, window.innerHeight);
  const width = right - left;
  const height = bottom - top;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return {
    x: left,
    y: top,
    width,
    height,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

function reportShortcutError(error: unknown): void {
  console.warn("[X Keyboard Extras]", getErrorMessage(error));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  const editable = target.closest(
    [
      "input",
      "textarea",
      "select",
      '[contenteditable=""]',
      '[contenteditable="true"]',
      '[role="textbox"]',
    ].join(","),
  );

  return Boolean(editable);
}

function findKeyboardSelectedTweet(): Element | null {
  const activeElement = document.activeElement;

  if (activeElement instanceof Element) {
    const activeDescendantTweet = findActiveDescendantTweet(activeElement);
    if (activeDescendantTweet) {
      return activeDescendantTweet;
    }

    const focusedTweet = activeElement.closest(TWEET_SELECTOR);
    if (focusedTweet && isUsableTweet(focusedTweet)) {
      return focusedTweet;
    }

    if (isFocusedSingleTweetWrapper(activeElement)) {
      const wrappedTweet = activeElement.querySelector(TWEET_SELECTOR);
      if (wrappedTweet && isUsableTweet(wrappedTweet)) {
        return wrappedTweet;
      }
    }
  }

  const focusWithinTweet = document.querySelector(
    `${TWEET_SELECTOR}:focus-within`,
  );
  return focusWithinTweet && isUsableTweet(focusWithinTweet)
    ? focusWithinTweet
    : null;
}

function isUsableTweet(tweet: Element): boolean {
  return tweet.isConnected && isVisible(tweet) && isInViewport(tweet);
}

function findActiveDescendantTweet(activeElement: Element): Element | null {
  const activeDescendantId = activeElement.getAttribute(
    "aria-activedescendant",
  );
  if (!activeDescendantId) {
    return null;
  }

  const activeDescendant = document.getElementById(activeDescendantId);
  if (!activeDescendant) {
    return null;
  }

  const tweet =
    activeDescendant.closest(TWEET_SELECTOR) ||
    activeDescendant.querySelector(TWEET_SELECTOR);

  return tweet && isUsableTweet(tweet) ? tweet : null;
}

function isFocusedSingleTweetWrapper(element: Element): boolean {
  if (element === document.body || element === document.documentElement) {
    return false;
  }

  if (!isLikelyFocusedContainer(element)) {
    return false;
  }

  const visibleTweets = Array.from(
    element.querySelectorAll(TWEET_SELECTOR),
  ).filter(isUsableTweet);
  return visibleTweets.length === 1;
}

function isLikelyFocusedContainer(element: Element): boolean {
  return (
    element.matches("[tabindex], [role], [aria-selected]") ||
    element.hasAttribute("aria-activedescendant")
  );
}

function isInViewport(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
}

function findShowMoreControl(tweet: Element): HTMLElement | null {
  const candidates = Array.from(tweet.querySelectorAll(CLICKABLE_SELECTOR));

  for (const candidate of candidates) {
    if (isShowMoreElement(candidate)) {
      return candidate;
    }
  }

  const walker = document.createTreeWalker(tweet, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();

  while (node) {
    if (node instanceof HTMLElement && isShowMoreText(node)) {
      return findClickableAncestor(node, tweet) || node;
    }

    node = walker.nextNode();
  }

  return null;
}

function findReferencedTweetUrl(tweet: Element): string | null {
  const ownStatusId = findOwnStatusId(tweet);
  if (!ownStatusId) {
    return null;
  }

  const statusTargets = Array.from(
    tweet.querySelectorAll<HTMLAnchorElement>("a[href]"),
  )
    .filter(isVisible)
    .map(getStatusTarget)
    .filter(isStatusTarget);

  const referencedStatusTarget = uniqueStatusTargets(statusTargets).find(
    (statusTarget) => statusTarget.statusId !== ownStatusId,
  );

  return referencedStatusTarget?.url ?? null;
}

function findOwnStatusId(tweet: Element): string | null {
  const timestamp = tweet.querySelector("time");
  const timestampLink = timestamp?.closest<HTMLAnchorElement>("a[href]");
  const timestampStatusTarget = timestampLink
    ? getStatusTarget(timestampLink)
    : null;

  if (timestampStatusTarget) {
    return timestampStatusTarget.statusId;
  }

  const firstStatusTarget = Array.from(
    tweet.querySelectorAll<HTMLAnchorElement>("a[href]"),
  )
    .filter(isVisible)
    .map(getStatusTarget)
    .find(isStatusTarget);

  return firstStatusTarget?.statusId ?? null;
}

type StatusTarget = {
  statusId: string;
  url: string;
};

function getStatusTarget(link: HTMLAnchorElement): StatusTarget | null {
  const url = new URL(link.href, window.location.href);
  const match = STATUS_PATH_RE.exec(url.pathname);
  const screenName = match?.[1];
  const statusId = match?.[2];

  if (!screenName || !statusId) {
    return null;
  }

  const normalizedPath =
    screenName === "i"
      ? `/i/status/${statusId}`
      : `/${screenName}/status/${statusId}`;

  return {
    statusId,
    url: new URL(normalizedPath, window.location.origin).toString(),
  };
}

function isStatusTarget(
  statusTarget: StatusTarget | null,
): statusTarget is StatusTarget {
  return statusTarget !== null;
}

function uniqueStatusTargets(statusTargets: StatusTarget[]): StatusTarget[] {
  const seenStatusIds = new Set<string>();

  return statusTargets.filter((statusTarget) => {
    if (seenStatusIds.has(statusTarget.statusId)) {
      return false;
    }

    seenStatusIds.add(statusTarget.statusId);
    return true;
  });
}

function isShowMoreElement(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement) || !isVisible(element)) {
    return false;
  }

  const label = getAccessibleLabel(element);
  return SHOW_MORE_RE.test(label);
}

function isShowMoreText(element: HTMLElement): boolean {
  if (!isVisible(element)) {
    return false;
  }

  return SHOW_MORE_RE.test(normalizeText(element.textContent));
}

function findClickableAncestor(
  element: HTMLElement,
  boundary: Element,
): HTMLElement | null {
  let current: HTMLElement | null = element;

  while (current && current !== boundary) {
    if (current.matches(CLICKABLE_SELECTOR) && isVisible(current)) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function getAccessibleLabel(element: HTMLElement): string {
  return normalizeText(
    element.getAttribute("aria-label") ||
      element.getAttribute("title") ||
      element.textContent,
  );
}

function normalizeText(text: string | null): string {
  return (text || "").replace(/\s+/g, " ").trim();
}

function isVisible(element: Element): boolean {
  const rects = element.getClientRects();
  if (rects.length === 0) {
    return false;
  }

  const style = window.getComputedStyle(element);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    Number(style.opacity) !== 0
  );
}
