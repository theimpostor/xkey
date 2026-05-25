import {
  CAPTURE_VISIBLE_TWEET_MESSAGE,
  type CaptureVisibleTweetRequest,
  type CaptureVisibleTweetResponse,
  type Rect,
} from "./messages";

const SHOW_MORE_KEY = "h";
const OPEN_REFERENCED_TWEET_KEY = "o";
const SCREENSHOT_TWEET_KEY = "s";
const EXPLAIN_POST_WITH_GROK_KEY = "g";
const EXTENSION_SHORTCUT_HELP_SHORTCUTS = [
  {
    id: "show-more",
    label: "Expand 'Show more'",
    keys: [SHOW_MORE_KEY],
  },
  {
    id: "explain-post-with-grok",
    label: "Explain with Grok",
    keys: ["Shift", EXPLAIN_POST_WITH_GROK_KEY.toUpperCase()],
  },
  {
    id: "open-referenced-post",
    label: "Open subtweet",
    keys: ["Shift", OPEN_REFERENCED_TWEET_KEY.toUpperCase()],
  },
  {
    id: "copy-post-screenshot",
    label: "Copy screenshot",
    keys: ["Shift", SCREENSHOT_TWEET_KEY.toUpperCase()],
  },
] as const;
const TWEET_SELECTOR = 'article[data-testid="tweet"]';
const CLICKABLE_SELECTOR = [
  "a",
  "button",
  '[role="button"]',
  '[role="link"]',
  "[tabindex]",
  "[data-testid]",
].join(",");

const SHOW_MORE_RE = /^show more$/i;
const EXPLAIN_POST_WITH_GROK_RE = /^(explain this post|grok(?: actions)?)$/i;
const GROK_TEST_ID_RE = /grok/i;
const STATUS_PATH_RE = /^\/([^/]+)\/status\/(\d+)(\/.*)?$/;
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6, [role="heading"]';
const SHORTCUT_TABLE_SELECTOR = 'table, [role="table"]';
const SHORTCUT_ROW_SELECTOR = 'tr, [role="row"]';
const SHORTCUT_CELL_SELECTOR =
  'td, th, [role="cell"], [role="gridcell"], [role="columnheader"]';
const KEYBOARD_SHORTCUT_HELP_TITLE = "Keyboard shortcuts";
const EXTENSION_SHORTCUT_HELP_HOST_SECTION_TITLE = "Media";
const EXTENSION_SHORTCUT_HELP_SECTION_TITLE = "xkey";
const EXTENSION_SHORTCUT_HELP_MARKER = "data-x-keyboard-extras-shortcut";
const PROMOTED_TWEET_STATE_ATTRIBUTE = "data-x-keyboard-extras-promoted-tweet";
const PROMOTED_TWEET_SIGNATURE_ATTRIBUTE =
  "data-x-keyboard-extras-promoted-tweet-signature";
const PROMOTED_TWEET_SUMMARY_ATTRIBUTE =
  "data-x-keyboard-extras-promoted-tweet-summary";
const PROMOTED_TWEET_LABEL_SELECTOR = "span, div";
const PROMOTED_TWEET_LABEL_EXCLUSION_SELECTOR = [
  '[data-testid="tweetText"]',
  '[data-testid="User-Name"]',
  '[data-testid="card.wrapper"]',
].join(",");
const PROMOTED_TWEET_LABEL_RE = /^(ad|promoted|sponsored|promoted by\b.*)$/i;
const PROMOTED_TWEET_LABEL_MAX_TOP_OFFSET = 96;
const PROMOTED_TWEET_LABEL_MAX_USER_NAME_TOP_DELTA = 32;
const PROMOTED_TWEET_COLLAPSED_STATE = "collapsed";
const PROMOTED_TWEET_EXPANDED_STATE = "expanded";

let keyboardShortcutHelpAugmentationFrame = 0;
let promotedTweetCollapsingFrame = 0;
let promotedTweetCollapseStyle: HTMLStyleElement | null = null;

document.addEventListener("keydown", handleKeydown, true);
startKeyboardShortcutHelpAugmenter();
startPromotedTweetCollapser();

function startPromotedTweetCollapser(): void {
  schedulePromotedTweetCollapsing();

  const observer = new MutationObserver(schedulePromotedTweetCollapsing);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function schedulePromotedTweetCollapsing(): void {
  if (promotedTweetCollapsingFrame !== 0) {
    return;
  }

  promotedTweetCollapsingFrame = window.requestAnimationFrame(() => {
    promotedTweetCollapsingFrame = 0;
    collapsePromotedTweets();
  });
}

function collapsePromotedTweets(): void {
  ensurePromotedTweetCollapseStyle();

  for (const tweet of document.querySelectorAll<HTMLElement>(TWEET_SELECTOR)) {
    updatePromotedTweetCollapse(tweet);
  }
}

function updatePromotedTweetCollapse(tweet: HTMLElement): void {
  const previousSignature = tweet.getAttribute(
    PROMOTED_TWEET_SIGNATURE_ATTRIBUTE,
  );
  const signature = getPromotedTweetSignature(tweet);

  if (previousSignature !== null && previousSignature !== signature) {
    resetPromotedTweetCollapse(tweet);
  }

  if (isManagedPromotedTweet(tweet)) {
    ensurePromotedTweetSummary(tweet);
    return;
  }

  if (!isPromotedTweet(tweet)) {
    resetPromotedTweetCollapse(tweet);
    return;
  }

  tweet.setAttribute(
    PROMOTED_TWEET_STATE_ATTRIBUTE,
    PROMOTED_TWEET_COLLAPSED_STATE,
  );
  tweet.setAttribute(PROMOTED_TWEET_SIGNATURE_ATTRIBUTE, signature);
  ensurePromotedTweetSummary(tweet);
}

function isManagedPromotedTweet(tweet: HTMLElement): boolean {
  return (
    tweet.getAttribute(PROMOTED_TWEET_STATE_ATTRIBUTE) ===
      PROMOTED_TWEET_COLLAPSED_STATE ||
    tweet.getAttribute(PROMOTED_TWEET_STATE_ATTRIBUTE) ===
      PROMOTED_TWEET_EXPANDED_STATE
  );
}

function resetPromotedTweetCollapse(tweet: HTMLElement): void {
  tweet.removeAttribute(PROMOTED_TWEET_STATE_ATTRIBUTE);
  tweet.removeAttribute(PROMOTED_TWEET_SIGNATURE_ATTRIBUTE);
  findPromotedTweetSummary(tweet)?.remove();
}

function ensurePromotedTweetCollapseStyle(): void {
  if (promotedTweetCollapseStyle?.isConnected) {
    return;
  }

  promotedTweetCollapseStyle = document.createElement("style");
  promotedTweetCollapseStyle.textContent = `
[${PROMOTED_TWEET_STATE_ATTRIBUTE}="${PROMOTED_TWEET_COLLAPSED_STATE}"] > :not([${PROMOTED_TWEET_SUMMARY_ATTRIBUTE}]) {
  display: none !important;
}
[${PROMOTED_TWEET_SUMMARY_ATTRIBUTE}] {
  align-items: center;
  box-sizing: border-box;
  color: inherit;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  min-height: 56px;
  padding: 12px 16px;
}
[${PROMOTED_TWEET_SUMMARY_ATTRIBUTE}] span {
  color: rgb(83, 100, 113);
  font: 14px/20px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
[${PROMOTED_TWEET_SUMMARY_ATTRIBUTE}] button {
  background: transparent;
  border: 1px solid rgb(83, 100, 113);
  border-radius: 9999px;
  color: inherit;
  cursor: pointer;
  font: 700 14px/20px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  min-height: 32px;
  padding: 5px 14px;
}
[${PROMOTED_TWEET_SUMMARY_ATTRIBUTE}] button:hover {
  background: rgba(83, 100, 113, 0.12);
}
`;
  (document.head || document.documentElement).append(
    promotedTweetCollapseStyle,
  );
}

function ensurePromotedTweetSummary(tweet: HTMLElement): void {
  const summary =
    findPromotedTweetSummary(tweet) || createPromotedTweetSummary();
  const button = summary.querySelector("button");
  const collapsed =
    tweet.getAttribute(PROMOTED_TWEET_STATE_ATTRIBUTE) !==
    PROMOTED_TWEET_EXPANDED_STATE;

  if (!summary.isConnected || summary.parentElement !== tweet) {
    tweet.prepend(summary);
  }

  if (button) {
    button.textContent = collapsed ? "Show" : "Hide";
    button.setAttribute("aria-expanded", String(!collapsed));
    button.setAttribute(
      "aria-label",
      collapsed ? "Show promoted post" : "Hide promoted post",
    );
  }
}

function findPromotedTweetSummary(tweet: Element): HTMLElement | null {
  return tweet.querySelector<HTMLElement>(
    `:scope > [${PROMOTED_TWEET_SUMMARY_ATTRIBUTE}]`,
  );
}

function createPromotedTweetSummary(): HTMLElement {
  const summary = document.createElement("div");
  summary.setAttribute(PROMOTED_TWEET_SUMMARY_ATTRIBUTE, "true");

  const label = document.createElement("span");
  label.textContent = "Promoted post";

  const button = document.createElement("button");
  button.type = "button";
  button.addEventListener("click", handlePromotedTweetSummaryClick);

  summary.append(label, button);
  return summary;
}

function handlePromotedTweetSummaryClick(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();

  const button = event.currentTarget;
  if (!(button instanceof HTMLElement)) {
    return;
  }

  const tweet = button.closest<HTMLElement>(TWEET_SELECTOR);
  if (!tweet) {
    return;
  }

  const isExpanded =
    tweet.getAttribute(PROMOTED_TWEET_STATE_ATTRIBUTE) ===
    PROMOTED_TWEET_EXPANDED_STATE;

  tweet.setAttribute(
    PROMOTED_TWEET_STATE_ATTRIBUTE,
    isExpanded ? PROMOTED_TWEET_COLLAPSED_STATE : PROMOTED_TWEET_EXPANDED_STATE,
  );
  ensurePromotedTweetSummary(tweet);
  tweet.focus();
}

function getPromotedTweetSignature(tweet: Element): string {
  const text = [
    tweet.querySelector('[data-testid="User-Name"]')?.textContent,
    tweet.querySelector('[data-testid="tweetText"]')?.textContent,
    tweet.querySelector('[data-testid="card.wrapper"]')?.textContent,
  ]
    .map((text) => normalizeText(text ?? null))
    .filter(Boolean)
    .join(" ");
  const links = Array.from(tweet.querySelectorAll<HTMLAnchorElement>("a[href]"))
    .filter((link) => !link.closest(`[${PROMOTED_TWEET_SUMMARY_ATTRIBUTE}]`))
    .map((link) => link.href)
    .slice(0, 8)
    .join(" ");
  const fallbackText = Array.from(tweet.childNodes)
    .filter((node) => !isPromotedTweetSummaryNode(node))
    .map((node) => normalizeText(node.textContent))
    .filter(Boolean)
    .join(" ");

  return `${text || fallbackText} ${links}`.slice(0, 1_000);
}

function isPromotedTweetSummaryNode(node: ChildNode): boolean {
  return (
    node instanceof Element &&
    node.hasAttribute(PROMOTED_TWEET_SUMMARY_ATTRIBUTE)
  );
}

function isPromotedTweet(tweet: Element): boolean {
  return Array.from(
    tweet.querySelectorAll<HTMLElement>(PROMOTED_TWEET_LABEL_SELECTOR),
  ).some((element) => isPromotedTweetLabel(element, tweet));
}

function isPromotedTweetLabel(element: HTMLElement, tweet: Element): boolean {
  if (
    !isVisible(element) ||
    element.closest(PROMOTED_TWEET_LABEL_EXCLUSION_SELECTOR)
  ) {
    return false;
  }

  const text = normalizeText(element.textContent);
  if (!PROMOTED_TWEET_LABEL_RE.test(text)) {
    return false;
  }

  return isInPromotedTweetLabelRegion(element, tweet);
}

function isInPromotedTweetLabelRegion(
  element: HTMLElement,
  tweet: Element,
): boolean {
  const tweetRect = tweet.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  if (
    elementRect.top < tweetRect.top ||
    elementRect.top - tweetRect.top > PROMOTED_TWEET_LABEL_MAX_TOP_OFFSET
  ) {
    return false;
  }

  const userName = tweet.querySelector<HTMLElement>(
    '[data-testid="User-Name"]',
  );
  if (!userName || !isVisible(userName)) {
    return true;
  }

  const userNameRect = userName.getBoundingClientRect();
  return (
    elementRect.left >= userNameRect.left &&
    Math.abs(elementRect.top - userNameRect.top) <=
      PROMOTED_TWEET_LABEL_MAX_USER_NAME_TOP_DELTA
  );
}

function startKeyboardShortcutHelpAugmenter(): void {
  scheduleKeyboardShortcutHelpAugmentation();

  const observer = new MutationObserver(
    scheduleKeyboardShortcutHelpAugmentation,
  );
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

function scheduleKeyboardShortcutHelpAugmentation(): void {
  if (keyboardShortcutHelpAugmentationFrame !== 0) {
    return;
  }

  keyboardShortcutHelpAugmentationFrame = window.requestAnimationFrame(() => {
    keyboardShortcutHelpAugmentationFrame = 0;
    augmentKeyboardShortcutHelp();
  });
}

function augmentKeyboardShortcutHelp(): void {
  const root = findKeyboardShortcutHelpRoot();
  if (!root) {
    return;
  }

  const hostSection = findKeyboardShortcutHelpSection(
    root,
    EXTENSION_SHORTCUT_HELP_HOST_SECTION_TITLE,
  );

  if (
    !hostSection ||
    hostSection.querySelector(`[${EXTENSION_SHORTCUT_HELP_MARKER}]`)
  ) {
    return;
  }

  appendExtensionShortcutHelpSection(hostSection);
}

function findKeyboardShortcutHelpRoot(): HTMLElement | null {
  const titleHeadings = findVisibleHeadingsByText(
    document.documentElement,
    KEYBOARD_SHORTCUT_HELP_TITLE,
  );

  for (const titleHeading of titleHeadings) {
    let current = titleHeading.parentElement;

    while (current && current !== document.body) {
      const hasNavigationSection = Boolean(
        findKeyboardShortcutHelpSection(current, "Navigation"),
      );
      const hasActionsSection = Boolean(
        findKeyboardShortcutHelpSection(current, "Actions"),
      );

      if (hasNavigationSection && hasActionsSection) {
        return current;
      }

      current = current.parentElement;
    }
  }

  return null;
}

function findKeyboardShortcutHelpSection(
  root: ParentNode,
  title: string,
): HTMLElement | null {
  const heading = findVisibleHeadingsByText(root, title)[0];
  if (!heading) {
    return null;
  }

  let current = heading.parentElement;

  while (current && current !== document.body) {
    if (findShortcutTable(current)) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function findVisibleHeadingsByText(
  root: ParentNode,
  text: string,
): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(HEADING_SELECTOR),
  ).filter(
    (heading) =>
      isVisible(heading) && normalizeText(heading.textContent) === text,
  );
}

function findShortcutTable(root: ParentNode): HTMLElement | null {
  return root.querySelector<HTMLElement>(SHORTCUT_TABLE_SELECTOR);
}

function appendExtensionShortcutHelpSection(hostSection: HTMLElement): void {
  const templateHeading = findShortcutSectionHeading(hostSection);
  const templateTable = findShortcutTable(hostSection);
  const templateRow = templateTable
    ? findShortcutRowTemplate(templateTable)
    : null;

  if (!templateHeading || !templateTable || !templateRow) {
    return;
  }

  const heading = templateHeading.cloneNode(true) as HTMLElement;
  heading.textContent = EXTENSION_SHORTCUT_HELP_SECTION_TITLE;
  heading.setAttribute(EXTENSION_SHORTCUT_HELP_MARKER, "heading");
  applyShortcutSectionHeadingStyle(templateHeading, heading);

  const table = templateTable.cloneNode(true) as HTMLElement;
  table.setAttribute(EXTENSION_SHORTCUT_HELP_MARKER, "table");

  const insertionTarget = findShortcutTableInsertionTarget(table);
  insertionTarget.replaceChildren();

  for (const shortcut of EXTENSION_SHORTCUT_HELP_SHORTCUTS) {
    insertionTarget.append(createShortcutHelpRow(templateRow, shortcut));
  }

  hostSection.append(heading, table);
}

function findShortcutSectionHeading(root: ParentNode): HTMLElement | null {
  return root.querySelector<HTMLElement>(HEADING_SELECTOR);
}

function applyShortcutSectionHeadingStyle(
  source: HTMLElement,
  target: HTMLElement,
): void {
  const sourceStyle = window.getComputedStyle(source);

  target.style.color = sourceStyle.color;
  target.style.font = sourceStyle.font;
  target.style.fontSize = "20px";
  target.style.fontWeight = "700";
  target.style.lineHeight = "24px";
  target.style.letterSpacing = sourceStyle.letterSpacing;
  target.style.marginBottom = "12px";
  target.style.marginTop = "16px";
}

function findShortcutTableInsertionTarget(table: HTMLElement): HTMLElement {
  return table.querySelector<HTMLElement>("tbody") ?? table;
}

function findShortcutRowTemplate(table: HTMLElement): HTMLElement | null {
  const rows = Array.from(
    table.querySelectorAll<HTMLElement>(SHORTCUT_ROW_SELECTOR),
  ).filter((row) => getDirectShortcutCells(row).length >= 2);

  return rows[rows.length - 1] ?? null;
}

type ExtensionShortcutHelpShortcut =
  (typeof EXTENSION_SHORTCUT_HELP_SHORTCUTS)[number];

function createShortcutHelpRow(
  templateRow: HTMLElement,
  shortcut: ExtensionShortcutHelpShortcut,
): HTMLElement {
  const row = templateRow.cloneNode(true) as HTMLElement;
  row.setAttribute(EXTENSION_SHORTCUT_HELP_MARKER, shortcut.id);

  const cells = getDirectShortcutCells(row);
  const [labelCell, shortcutCell] = cells;

  if (labelCell) {
    labelCell.textContent = shortcut.label;
  }

  if (shortcutCell) {
    renderShortcutKeys(shortcutCell, shortcut.keys);
  }

  return row;
}

function getDirectShortcutCells(row: HTMLElement): HTMLElement[] {
  return Array.from(
    row.querySelectorAll<HTMLElement>(SHORTCUT_CELL_SELECTOR),
  ).filter((cell) => cell.closest(SHORTCUT_ROW_SELECTOR) === row);
}

function renderShortcutKeys(cell: HTMLElement, keys: readonly string[]): void {
  const keycapTemplate = findKeycapTemplate(cell);
  cell.replaceChildren();

  keys.forEach((key, index) => {
    if (index > 0) {
      cell.append(createShortcutKeySeparator());
    }

    cell.append(createShortcutKeyElement(key, keycapTemplate));
  });
}

function findKeycapTemplate(cell: HTMLElement): HTMLElement | null {
  const candidates = Array.from(cell.querySelectorAll<HTMLElement>("*")).filter(
    (element) => {
      const text = normalizeText(element.textContent);
      return text.length > 0 && text !== "+";
    },
  );

  for (const candidate of candidates) {
    const keycap = findStyledKeycapAncestor(candidate, cell);
    if (keycap) {
      return keycap;
    }
  }

  return cell.firstElementChild instanceof HTMLElement
    ? cell.firstElementChild
    : null;
}

function findStyledKeycapAncestor(
  element: HTMLElement,
  boundary: HTMLElement,
): HTMLElement | null {
  let current: HTMLElement | null = element;
  let keycap: HTMLElement | null = null;

  while (current && current !== boundary) {
    if (hasKeycapStyle(current)) {
      keycap = current;
    }

    current = current.parentElement;
  }

  return keycap;
}

function hasKeycapStyle(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);

  return (
    style.borderTopStyle !== "none" ||
    style.backgroundColor !== "rgba(0, 0, 0, 0)" ||
    style.borderRadius !== "0px"
  );
}

function createShortcutKeyElement(
  key: string,
  template: HTMLElement | null,
): HTMLElement {
  const keyElement = template
    ? (template.cloneNode(true) as HTMLElement)
    : document.createElement("kbd");

  keyElement.textContent = key;
  return keyElement;
}

function createShortcutKeySeparator(): Text {
  return document.createTextNode(" + ");
}

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

  if (isExplainPostWithGrokShortcut(event)) {
    const control = findExplainPostWithGrokControl(selectedTweet);
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
  const referencedTweetCard = referencedTweetUrl
    ? null
    : findReferencedTweetCard(selectedTweet);

  if (!referencedTweetUrl && !referencedTweetCard) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();

  if (referencedTweetUrl) {
    window.location.assign(referencedTweetUrl);
    return;
  }

  referencedTweetCard?.click();
}

function isSupportedShortcut(event: KeyboardEvent): boolean {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
    return false;
  }

  return (
    isShowMoreShortcut(event) ||
    isOpenReferencedTweetShortcut(event) ||
    isScreenshotTweetShortcut(event) ||
    isExplainPostWithGrokShortcut(event)
  );
}

function isShowMoreShortcut(event: KeyboardEvent): boolean {
  return !event.shiftKey && event.key.toLowerCase() === SHOW_MORE_KEY;
}

function isOpenReferencedTweetShortcut(event: KeyboardEvent): boolean {
  return (
    event.key === OPEN_REFERENCED_TWEET_KEY.toUpperCase() ||
    (event.shiftKey && event.key.toLowerCase() === OPEN_REFERENCED_TWEET_KEY)
  );
}

function isScreenshotTweetShortcut(event: KeyboardEvent): boolean {
  return (
    event.key === SCREENSHOT_TWEET_KEY.toUpperCase() ||
    (event.shiftKey && event.key.toLowerCase() === SCREENSHOT_TWEET_KEY)
  );
}

function isExplainPostWithGrokShortcut(event: KeyboardEvent): boolean {
  return (
    event.key === EXPLAIN_POST_WITH_GROK_KEY.toUpperCase() ||
    (event.shiftKey && event.key.toLowerCase() === EXPLAIN_POST_WITH_GROK_KEY)
  );
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
  return getViewportClippedRect(tweet);
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
  if (focusWithinTweet && isUsableTweet(focusWithinTweet)) {
    return focusWithinTweet;
  }

  return findPrimaryVisibleTweet();
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

function findPrimaryVisibleTweet(): Element | null {
  const visibleTweets = Array.from(document.querySelectorAll(TWEET_SELECTOR))
    .filter(isUsableTweet)
    .sort((first, second) => {
      const firstArea = getVisibleArea(first);
      const secondArea = getVisibleArea(second);
      return secondArea - firstArea;
    });

  return visibleTweets[0] ?? null;
}

function getVisibleArea(element: Element): number {
  const rect = getViewportClippedRect(element);
  return rect ? rect.width * rect.height : 0;
}

function getViewportClippedRect(element: Element): Rect | null {
  const rect = element.getBoundingClientRect();
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

function findExplainPostWithGrokControl(tweet: Element): HTMLElement | null {
  return (
    Array.from(tweet.querySelectorAll<HTMLElement>('button, [role="button"]'))
      .filter(isVisible)
      .find(isExplainPostWithGrokElement) ?? null
  );
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

function findReferencedTweetCard(tweet: Element): HTMLElement | null {
  const candidates = Array.from(
    tweet.querySelectorAll<HTMLElement>("*"),
  ).filter((candidate) => isReferencedTweetCardCandidate(candidate, tweet));

  return smallestElement(candidates);
}

function isReferencedTweetCardCandidate(
  element: HTMLElement,
  tweet: Element,
): boolean {
  if (!isVisible(element) || element.closest(TWEET_SELECTOR) !== tweet) {
    return false;
  }

  if (element === tweet || element.matches("a[href], button")) {
    return false;
  }

  const label = getAccessibleLabel(element);
  return (
    (/\bquote\b/i.test(label) && hasReferencedTweetByline(label)) ||
    isPointerCard(element, tweet)
  );
}

function hasReferencedTweetByline(label: string): boolean {
  return /@[a-z0-9_]{1,15}\b/i.test(label);
}

function isPointerCard(element: HTMLElement, tweet: Element): boolean {
  const area = getElementArea(element);
  if (area < 10_000 || window.getComputedStyle(element).cursor !== "pointer") {
    return false;
  }

  const ownStatusId = findOwnStatusId(tweet);
  if (!ownStatusId) {
    return false;
  }

  const statusTargets = Array.from(
    element.querySelectorAll<HTMLAnchorElement>("a[href]"),
  )
    .filter(isVisible)
    .map(getStatusTarget)
    .filter(isStatusTarget);

  return statusTargets.every(
    (statusTarget) => statusTarget.statusId === ownStatusId,
  );
}

function smallestElement(elements: HTMLElement[]): HTMLElement | null {
  return (
    elements.slice().sort((first, second) => {
      const firstArea = getElementArea(first);
      const secondArea = getElementArea(second);
      return firstArea - secondArea;
    })[0] ?? null
  );
}

function getElementArea(element: Element): number {
  const rect = element.getBoundingClientRect();
  return rect.width * rect.height;
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

function isExplainPostWithGrokElement(element: HTMLElement): boolean {
  const label = getAccessibleLabel(element);

  return EXPLAIN_POST_WITH_GROK_RE.test(label) || hasGrokTestId(element);
}

function hasGrokTestId(element: HTMLElement): boolean {
  const testId = element.getAttribute("data-testid");
  if (testId && GROK_TEST_ID_RE.test(testId)) {
    return true;
  }

  return Array.from(element.querySelectorAll<HTMLElement>("[data-testid]"))
    .map((descendant) => descendant.getAttribute("data-testid"))
    .some((descendantTestId) =>
      descendantTestId ? GROK_TEST_ID_RE.test(descendantTestId) : false,
    );
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
