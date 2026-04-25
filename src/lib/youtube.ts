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

export function seekToProgress(player: YT.Player, progress: number): void {
  const duration = player.getDuration?.() ?? 0;
  if (duration > 0) {
    player.seekTo(progress * duration, true);
  }
}

export function playFromProgress(
  player: YT.Player,
  progress: number,
  volume: number,
  urlExtractor: (url: string) => string | null
): void {
  const state = player.getPlayerState?.();

  if (state === YT.PlayerState.ENDED) {
    const videoUrl = player.getVideoUrl?.() ?? '';
    const id = urlExtractor(videoUrl);
    if (id) {
      const duration = player.getDuration?.() ?? 0;
      player.loadVideoById({
        videoId: id,
        startSeconds: duration > 0 ? progress * duration : 0
      });
      player.setVolume(volume);
    }
    return;
  }

  player.playVideo();
  const trySeek = () => {
    const duration = player.getDuration?.() ?? 0;
    if (duration > 0) {
      player.seekTo(progress * duration, true);
    } else {
      setTimeout(trySeek, 100);
    }
  };
  setTimeout(trySeek, 200);
}
