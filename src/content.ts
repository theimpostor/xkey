const SHOW_MORE_KEY = "h";
const OPEN_REFERENCED_TWEET_KEY = "o";
const TWEET_SELECTOR = 'article[data-testid="tweet"]';
const CLICKABLE_SELECTOR = [
  "a",
  "button",
  '[role="button"]',
  "[tabindex]",
  "[data-testid]"
].join(",");

const SHOW_MORE_RE = /^show more$/i;
const STATUS_PATH_RE = /^\/[^/]+\/status\/(\d+)/;

document.addEventListener("keydown", handleKeydown, true);

function handleKeydown(event: KeyboardEvent): void {
  if (!isSupportedShortcut(event) || isEditableTarget(event.target)) {
    return;
  }

  const selectedTweet = findKeyboardSelectedTweet();
  if (!selectedTweet) {
    return;
  }

  const control = isShowMoreShortcut(event)
    ? findShowMoreControl(selectedTweet)
    : findReferencedTweetLink(selectedTweet);

  if (!control) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  control.click();
}

function isSupportedShortcut(event: KeyboardEvent): boolean {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
    return false;
  }

  return isShowMoreShortcut(event) || isOpenReferencedTweetShortcut(event);
}

function isShowMoreShortcut(event: KeyboardEvent): boolean {
  return (
    !event.shiftKey &&
    event.key.toLowerCase() === SHOW_MORE_KEY
  );
}

function isOpenReferencedTweetShortcut(event: KeyboardEvent): boolean {
  return (
    event.shiftKey &&
    event.key.toLowerCase() === OPEN_REFERENCED_TWEET_KEY
  );
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
      '[role="textbox"]'
    ].join(",")
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

  const focusWithinTweet = document.querySelector(`${TWEET_SELECTOR}:focus-within`);
  return focusWithinTweet && isUsableTweet(focusWithinTweet)
    ? focusWithinTweet
    : null;
}

function isUsableTweet(tweet: Element): boolean {
  return tweet.isConnected && isVisible(tweet) && isInViewport(tweet);
}

function findActiveDescendantTweet(activeElement: Element): Element | null {
  const activeDescendantId = activeElement.getAttribute("aria-activedescendant");
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

  const visibleTweets = Array.from(element.querySelectorAll(TWEET_SELECTOR)).filter(
    isUsableTweet
  );
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

function findReferencedTweetLink(tweet: Element): HTMLElement | null {
  const ownStatusId = findOwnStatusId(tweet);
  if (!ownStatusId) {
    return null;
  }

  const statusLinks = Array.from(tweet.querySelectorAll<HTMLAnchorElement>("a[href]"))
    .filter(isVisible)
    .map(getStatusLink)
    .filter(isStatusLink);

  const referencedStatusLink = uniqueStatusLinks(statusLinks).find(
    (statusLink) => statusLink.statusId !== ownStatusId
  );

  return referencedStatusLink?.link ?? null;
}

function findOwnStatusId(tweet: Element): string | null {
  const timestamp = tweet.querySelector("time");
  const timestampLink = timestamp?.closest<HTMLAnchorElement>("a[href]");
  const timestampStatusLink = timestampLink ? getStatusLink(timestampLink) : null;

  if (timestampStatusLink) {
    return timestampStatusLink.statusId;
  }

  const firstStatusLink = Array.from(
    tweet.querySelectorAll<HTMLAnchorElement>("a[href]")
  )
    .filter(isVisible)
    .map(getStatusLink)
    .find(isStatusLink);

  return firstStatusLink?.statusId ?? null;
}

type StatusLink = {
  link: HTMLAnchorElement;
  statusId: string;
};

function getStatusLink(link: HTMLAnchorElement): StatusLink | null {
  const url = new URL(link.href, window.location.href);
  const match = STATUS_PATH_RE.exec(url.pathname);

  return match?.[1] ? { link, statusId: match[1] } : null;
}

function isStatusLink(statusLink: StatusLink | null): statusLink is StatusLink {
  return statusLink !== null;
}

function uniqueStatusLinks(statusLinks: StatusLink[]): StatusLink[] {
  const seenStatusIds = new Set<string>();

  return statusLinks.filter((statusLink) => {
    if (seenStatusIds.has(statusLink.statusId)) {
      return false;
    }

    seenStatusIds.add(statusLink.statusId);
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
  boundary: Element
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
      element.textContent
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
