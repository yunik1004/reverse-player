const VIDEO_ID_RE = /(?:youtu\.be\/|v=|\/embed\/|\/v\/)([\w-]{11})/;

export function extractVideoId(url: string): string | null {
  return url.match(VIDEO_ID_RE)?.[1] ?? null;
}

export function initYouTubeAPI(
  elementId: string,
  callbacks: {
    onReady: () => void;
    onEnded: () => void;
  }
): Promise<YT.Player> {
  return new Promise((resolve) => {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);

    (window as unknown as { onYouTubeIframeAPIReady: () => void }).onYouTubeIframeAPIReady = () => {
      const player = new YT.Player(elementId, {
        height: '1',
        width: '1',
        playerVars: { controls: 0, disablekb: 1 },
        events: {
          onReady: () => {
            callbacks.onReady();
            resolve(player);
          },
          onStateChange: (e: YT.OnStateChangeEvent) => {
            if (e.data === YT.PlayerState.ENDED) {
              callbacks.onEnded();
            }
          }
        }
      });
    };
  });
}

export interface PlayRange {
  start: number;
  end: number | null;
}

/** Get effective duration for a track (respecting start/end range) */
export function getEffectiveDuration(player: YT.Player, range: PlayRange): number {
  const total = player.getDuration?.() ?? 0;
  if (total <= 0) return 0;
  const end = range.end ?? total;
  return end - range.start;
}

/** Get playback progress [0,1] within the play range */
export function getRangeProgress(player: YT.Player, range: PlayRange): number | null {
  const duration = getEffectiveDuration(player, range);
  if (duration <= 0) return null;
  const current = (player.getCurrentTime?.() ?? 0) - range.start;
  return Math.max(0, Math.min(1, current / duration));
}

/** Convert a [0,1] progress within the range to absolute seconds */
export function rangeProgressToSeconds(
  player: YT.Player,
  progress: number,
  range: PlayRange
): number {
  const duration = getEffectiveDuration(player, range);
  return range.start + progress * duration;
}

export function playFromProgress(
  player: YT.Player,
  progress: number,
  volume: number,
  range: PlayRange
): void {
  const state = player.getPlayerState?.();

  if (state === YT.PlayerState.ENDED) {
    const videoUrl = player.getVideoUrl?.() ?? '';
    const id = extractVideoId(videoUrl);
    if (id) {
      const duration = getEffectiveDuration(player, range);
      player.loadVideoById({
        videoId: id,
        startSeconds: duration > 0 ? range.start + progress * duration : range.start
      });
      player.setVolume(volume);
    }
    return;
  }

  player.playVideo();
  const trySeek = () => {
    const duration = getEffectiveDuration(player, range);
    if (duration > 0) {
      player.seekTo(range.start + progress * duration, true);
    } else {
      setTimeout(trySeek, 100);
    }
  };
  setTimeout(trySeek, 200);
}
