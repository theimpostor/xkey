(() => {
  const SHORTCUT_KEY = "h";
  const TWEET_SELECTOR = 'article[data-testid="tweet"]';
  const CLICKABLE_SELECTOR = [
    "a",
    "button",
    '[role="button"]',
    '[tabindex]',
    '[data-testid]'
  ].join(",");

  const SHOW_MORE_RE = /^show more$/i;

  let lastInteractedTweet = null;

  document.addEventListener("keydown", handleKeydown, true);
  document.addEventListener("pointerover", rememberInteractedTweet, true);
  document.addEventListener("focusin", rememberInteractedTweet, true);

  function handleKeydown(event) {
    if (!isPlainShortcut(event) || isEditableTarget(event.target)) {
      return;
    }

    const control = findBestShowMoreControl();
    if (!control) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    control.click();
  }

  function isPlainShortcut(event) {
    return (
      !event.repeat &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === SHORTCUT_KEY
    );
  }

  function isEditableTarget(target) {
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

  function rememberInteractedTweet(event) {
    if (!(event.target instanceof Element)) {
      return;
    }

    const tweet = event.target.closest(TWEET_SELECTOR);
    if (tweet) {
      lastInteractedTweet = tweet;
    }
  }

  function findBestShowMoreControl() {
    const activeTweet = document.activeElement?.closest?.(TWEET_SELECTOR);
    const preferredTweets = uniqueElements([activeTweet, lastInteractedTweet]);

    for (const tweet of preferredTweets) {
      if (isUsableTweet(tweet)) {
        const control = findShowMoreControl(tweet);
        if (control) {
          return control;
        }
      }
    }

    for (const tweet of getVisibleTweets()) {
      const control = findShowMoreControl(tweet);
      if (control) {
        return control;
      }
    }

    return null;
  }

  function uniqueElements(elements) {
    return Array.from(new Set(elements.filter(Boolean)));
  }

  function isUsableTweet(tweet) {
    return tweet.isConnected && isVisible(tweet) && isInViewport(tweet);
  }

  function getVisibleTweets() {
    const centerY = window.innerHeight / 2;

    return Array.from(document.querySelectorAll(TWEET_SELECTOR))
      .filter(isUsableTweet)
      .sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        const aDistance = Math.abs((aRect.top + aRect.bottom) / 2 - centerY);
        const bDistance = Math.abs((bRect.top + bRect.bottom) / 2 - centerY);
        return aDistance - bDistance;
      });
  }

  function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight;
  }

  function findShowMoreControl(tweet) {
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

  function isShowMoreElement(element) {
    if (!(element instanceof HTMLElement) || !isVisible(element)) {
      return false;
    }

    const label = getAccessibleLabel(element);
    return SHOW_MORE_RE.test(label);
  }

  function isShowMoreText(element) {
    if (!isVisible(element)) {
      return false;
    }

    return SHOW_MORE_RE.test(normalizeText(element.textContent));
  }

  function findClickableAncestor(element, boundary) {
    let current = element;

    while (current && current !== boundary) {
      if (current.matches?.(CLICKABLE_SELECTOR) && isVisible(current)) {
        return current;
      }

      current = current.parentElement;
    }

    return null;
  }

  function getAccessibleLabel(element) {
    return normalizeText(
      element.getAttribute("aria-label") ||
        element.getAttribute("title") ||
        element.textContent
    );
  }

  function normalizeText(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function isVisible(element) {
    if (!(element instanceof Element)) {
      return false;
    }

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
})();
