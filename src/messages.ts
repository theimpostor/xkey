export const CAPTURE_VISIBLE_TWEET_MESSAGE =
  "x-keyboard-extras.capture-visible-tweet";

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Viewport = {
  width: number;
  height: number;
};

export type CaptureVisibleTweetRequest = {
  type: typeof CAPTURE_VISIBLE_TWEET_MESSAGE;
  rect: Rect;
  viewport: Viewport;
};

export type CaptureVisibleTweetResponse =
  | {
      ok: true;
      imageDataUrl: string;
    }
  | {
      ok: false;
      error: string;
    };
