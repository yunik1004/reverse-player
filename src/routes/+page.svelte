<script lang="ts">
  import { onMount } from 'svelte';
  import Turntable from '$lib/components/Turntable.svelte';
  import { angleToProgress, progressToAngle } from '$lib/tonearm';
  import {
    extractVideoId,
    initYouTubeAPI,
    playFromProgress,
    getRangeProgress,
    type PlayRange
  } from '$lib/youtube';
  import { base } from '$app/paths';
  import type { Track, TrackGroup } from '$lib/types';

  interface FlatTrack extends Track {
    groupCover?: string;
    groupVersion: string;
  }

  let volume = $state(100);
  let player = $state.raw<YT.Player | null>(null);
  let playerReady = $state(false);
  let motorOn = $state(false);
  let armOnRecord = $state(false);
  let ignoreYtState = false;
  let tonearmAngle = $state(progressToAngle(0));

  let groups = $state<TrackGroup[]>([]);
  let tracks = $state<FlatTrack[]>([]);
  let currentTrack = $state<FlatTrack | null>(null);
  let playRange = $state<PlayRange>({ start: 0, end: null });
  let showPlaylist = $state(false);
  let danceEnabled = $state(false);
  let videoVisible = $state(false);
  let extraEnabled = $state(false);
  const visibleTracks = $derived(extraEnabled ? tracks : tracks.filter((t) => !t.extra));
  let playMode = $state<'sequential' | 'shuffle' | 'repeat' | 'once'>('sequential');
  let shuffleQueue = $state<number[]>([]);

  onMount(async () => {
    player = await initYouTubeAPI('yt-player', {
      onReady: () => {
        playerReady = true;
      },
      onEnded: () => {
        playNext();
      },
      onPaused: () => {
        if (videoVisible && !ignoreYtState) motorOn = false;
      },
      onPlaying: () => {
        if (videoVisible && !ignoreYtState && !motorOn) motorOn = true;
      }
    });

    const playlistRes = await fetch(`${base}/playlist.json`);
    if (playlistRes.ok) {
      groups = await playlistRes.json();
      tracks = groups.flatMap((g) =>
        g.tracks.map((t) => ({
          ...t,
          cover: (t.cover ?? g.cover)?.replace(/^\//, `${base}/`),
          groupCover: g.cover,
          groupVersion: g.version
        }))
      );
    }
  });

  function loadTrack(track: FlatTrack) {
    currentTrack = track;
    playRange = { start: track.start ?? 0, end: track.end ?? null };
    const id = extractVideoId(track.url);
    if (!id || !player) return;
    player.cueVideoById(id);
    player.setVolume(volume);
    tonearmAngle = progressToAngle(0);
    if (motorOn && armOnRecord) {
      seekToArm(tonearmAngle);
    }
  }

  function buildShuffleQueue() {
    const indices = visibleTracks.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  }

  function cyclePlayMode() {
    if (playMode === 'sequential') {
      playMode = 'shuffle';
      shuffleQueue = buildShuffleQueue();
    } else if (playMode === 'shuffle') {
      playMode = 'repeat';
      shuffleQueue = [];
    } else if (playMode === 'repeat') {
      playMode = 'once';
    } else {
      playMode = 'sequential';
    }
  }

  const playModeIcon = $derived(
    { sequential: '\u2192', shuffle: '\u21C4', repeat: '\u21BB', once: '1' }[playMode]
  );

  function playNext() {
    if (visibleTracks.length === 0) return;

    if (playMode === 'repeat') {
      if (currentTrack) loadTrack(currentTrack);
      return;
    }

    if (playMode === 'once') {
      player?.pauseVideo();
      return;
    }

    if (playMode === 'shuffle') {
      if (shuffleQueue.length === 0) {
        shuffleQueue = buildShuffleQueue();
      }
      const idx = shuffleQueue[0];
      shuffleQueue = shuffleQueue.slice(1);
      loadTrack(visibleTracks[idx]);
    } else {
      const currentIdx = currentTrack ? visibleTracks.indexOf(currentTrack) : -1;
      const nextIdx = (currentIdx + 1) % visibleTracks.length;
      loadTrack(visibleTracks[nextIdx]);
    }
  }

  function seekToArm(angle: number) {
    if (!player || !playerReady) return;
    ignoreYtState = true;
    playFromProgress(player, angleToProgress(angle), volume, playRange);
    setTimeout(() => (ignoreYtState = false), 1000);
  }

  function pause() {
    ignoreYtState = true;
    player?.pauseVideo();
    setTimeout(() => (ignoreYtState = false), 500);
  }

  function getPlaybackProgress(): number | null {
    if (!player || !playerReady) return null;
    const progress = getRangeProgress(player, playRange);
    if (progress !== null && playRange.end !== null) {
      const current = player.getCurrentTime?.() ?? 0;
      if (current >= playRange.end) {
        playNext();
        return 1;
      }
    }
    return progress;
  }

  function marqueeIfOverflow(node: HTMLElement) {
    const scroll = node.querySelector('.track-name-scroll') as HTMLElement;
    const inner = node.querySelector('.track-name-inner') as HTMLElement;
    if (!scroll || !inner) return;

    function setup() {
      const existing = scroll.querySelector('.track-name-dup');
      if (existing) existing.remove();

      if (inner.scrollWidth > node.clientWidth) {
        node.classList.add('overflowing');
        const dup = inner.cloneNode(true) as HTMLElement;
        dup.classList.add('track-name-dup');
        scroll.appendChild(dup);
      } else {
        node.classList.remove('overflowing');
      }
    }

    setup();
    const observer = new ResizeObserver(setup);
    observer.observe(node);

    return { destroy: () => observer.disconnect() };
  }

  function togglePlaylist() {
    showPlaylist = !showPlaylist;
  }

  $effect(() => {
    const v = volume;
    if (player && playerReady) player.setVolume(v);
  });

  // extra 토글 시 셔플 큐 재빌드
  $effect(() => {
    void extraEnabled;
    if (playMode === 'shuffle') shuffleQueue = buildShuffleQueue();
  });
</script>

<div class="page">
  <div class="ornament top-left"></div>
  <div class="ornament top-right"></div>
  <div class="ornament bottom-left"></div>
  <div class="ornament bottom-right"></div>

  <div class="main-area">
    <Turntable
      bind:motorOn
      bind:armOnRecord
      bind:tonearmAngle
      bind:volume
      coverUrl={currentTrack?.cover ?? ''}
      {danceEnabled}
      {getPlaybackProgress}
      onSeek={seekToArm}
      onPause={pause}
      onTogglePlaylist={togglePlaylist}
    >
      <div class="yt-player" class:yt-visible={videoVisible}>
        <div id="yt-player"></div>
      </div>
    </Turntable>

    {#if tracks.length > 0}
      <div class="playlist-panel" class:open={showPlaylist}>
        <div class="playlist-inner">
          <div class="playlist-header">
            <div class="header-left">
              <button class="mode-btn" onclick={cyclePlayMode} aria-label="Play mode"
                >{playModeIcon}</button
              >
              <button
                class="mode-btn"
                class:active={extraEnabled}
                onclick={() => (extraEnabled = !extraEnabled)}
                aria-label="Toggle extra">extra</button
              >
              <button
                class="mode-btn"
                class:active={danceEnabled}
                onclick={() => (danceEnabled = !danceEnabled)}
                aria-label="Toggle dance">dance</button
              >
              <button
                class="mode-btn"
                class:active={videoVisible}
                onclick={() => (videoVisible = !videoVisible)}
                aria-label="Toggle video">video</button
              >
            </div>
            <button class="header-btn" onclick={togglePlaylist} aria-label="Close">&times;</button>
          </div>
          <div class="playlist-list">
            {#each visibleTracks as track (track.url)}
              <div class="track-row" class:active={currentTrack?.url === track.url}>
                <span class="track-name" use:marqueeIfOverflow>
                  <span class="track-name-scroll">
                    <span class="track-name-inner">{track.groupVersion} | {track.name}</span>
                  </span>
                </span>
                <button
                  class="track-play"
                  onclick={() => loadTrack(track)}
                  aria-label="Play {track.name}">&#9654;&#xFE0E;</button
                >
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap');

  .page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    background: radial-gradient(ellipse at center, #1a1814 0%, #100e0c 60%, #080706 100%);
    position: relative;
    overflow: hidden;
  }

  .yt-player {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
  }

  .yt-player.yt-visible {
    position: absolute;
    top: 8px;
    left: 8px;
    width: 160px;
    height: 90px;
    overflow: hidden;
    opacity: 1;
    pointer-events: auto;
    z-index: 40;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
  }

  .yt-player.yt-visible :global(iframe) {
    width: 100%;
    height: 100%;
  }

  .main-area {
    display: flex;
    align-items: center;
    z-index: 1;
  }

  /* Playlist panel */
  .playlist-panel {
    width: 0;
    overflow: hidden;
    transition: width 0.3s ease;
    direction: rtl;
  }

  .playlist-panel.open {
    width: 240px;
    margin-left: 24px;
  }

  .playlist-inner {
    width: 240px;
    direction: ltr;
    max-height: 420px;
    display: flex;
    flex-direction: column;
    background: rgba(20, 16, 10, 0.95);
    border: 1px solid rgba(60, 42, 22, 0.4);
    border-radius: 6px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
    overflow: hidden;
  }

  .playlist-header {
    padding: 8px 10px;
    border-bottom: 1px solid rgba(60, 42, 22, 0.3);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .mode-btn {
    background: rgba(212, 175, 55, 0.08);
    border: 1px solid rgba(60, 42, 22, 0.4);
    border-radius: 3px;
    color: rgb(212, 175, 55);
    font-size: 12px;
    cursor: pointer;
    padding: 2px 4px;
    min-width: 24px;
    text-align: center;
  }

  .mode-btn:hover {
    color: rgb(212, 175, 55);
    border-color: rgba(212, 175, 55, 0.5);
  }

  .mode-btn.active {
    background: rgba(212, 175, 55, 0.25);
    color: rgb(212, 175, 55);
    border-color: rgba(212, 175, 55, 0.5);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-btn {
    background: none;
    border: none;
    color: rgb(212, 175, 55);
    font-size: 14px;
    cursor: pointer;
    padding: 2px 6px;
  }

  .header-btn:hover {
    color: rgb(212, 175, 55);
  }

  .playlist-list {
    overflow-y: auto;
    padding: 6px 0;
    scrollbar-width: thin;
    scrollbar-color: rgba(212, 175, 55, 0.15) transparent;
  }

  .track-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    transition: background 0.15s;
  }

  .track-row:hover {
    background: rgba(40, 30, 18, 0.5);
  }

  .track-row.active {
    background: rgba(40, 30, 18, 0.8);
  }

  .track-name {
    flex: 1;
    overflow: hidden;
    white-space: nowrap;
    min-width: 0;
  }

  :global(.track-name-scroll) {
    display: inline-flex;
    gap: 3em;
  }

  .track-name-inner {
    flex-shrink: 0;
    font-family: 'Cinzel', serif;
    font-size: 9px;
    color: rgb(212, 175, 55);
    letter-spacing: 0.03em;
    white-space: nowrap;
  }

  :global(.track-name.overflowing:hover .track-name-scroll) {
    animation: marquee 8s linear infinite;
  }

  @keyframes marquee {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(calc(-50% - 1.5em));
    }
  }

  .track-play {
    flex-shrink: 0;
    background: none;
    border: none;
    color: rgb(212, 175, 55);
    font-size: 10px;
    cursor: pointer;
    padding: 2px 4px;
  }

  .track-play:hover {
    color: rgb(212, 175, 55);
  }

  @media (max-width: 768px) {
    .playlist-panel {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 0;
      max-height: 70vh;
      z-index: 100;
      transition:
        width 0.3s ease,
        opacity 0.3s ease;
      opacity: 0;
    }

    .playlist-panel.open {
      width: 90vw;
      max-width: 400px;
      opacity: 1;
    }

    .playlist-inner {
      width: 90vw;
      max-width: 400px;
      max-height: 70vh;
    }
  }

  .ornament {
    position: absolute;
    width: 80px;
    height: 80px;
    border-color: rgba(212, 175, 55, 0.15);
    border-style: solid;
    border-width: 0;
  }
  .top-left {
    top: 20px;
    left: 20px;
    border-top-width: 1px;
    border-left-width: 1px;
  }
  .top-right {
    top: 20px;
    right: 20px;
    border-top-width: 1px;
    border-right-width: 1px;
  }
  .bottom-left {
    bottom: 20px;
    left: 20px;
    border-bottom-width: 1px;
    border-left-width: 1px;
  }
  .bottom-right {
    bottom: 20px;
    right: 20px;
    border-bottom-width: 1px;
    border-right-width: 1px;
  }
</style>
