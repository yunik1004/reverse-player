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
  let tonearmAngle = $state(progressToAngle(0));

  let groups = $state<TrackGroup[]>([]);
  let tracks = $state<FlatTrack[]>([]);
  let currentTrack = $state<FlatTrack | null>(null);
  let playRange = $state<PlayRange>({ start: 0, end: null });
  let showPlaylist = $state(false);
  let shuffleMode = $state(false);
  let shuffleQueue = $state<number[]>([]);

  onMount(async () => {
    player = await initYouTubeAPI('yt-player', {
      onReady: () => {
        playerReady = true;
      },
      onEnded: () => {
        if (shuffleMode) {
          playNextShuffle();
        } else {
          player?.pauseVideo();
        }
      }
    });

    const res = await fetch('/playlist.json');
    if (res.ok) {
      groups = await res.json();
      tracks = groups.flatMap((g) =>
        g.tracks.map((t) => ({
          ...t,
          cover: t.cover ?? g.cover,
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
      seekToArm();
    }
  }

  function buildShuffleQueue() {
    const indices = tracks.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  }

  function playNextShuffle() {
    if (shuffleQueue.length === 0) {
      shuffleQueue = buildShuffleQueue();
    }
    if (shuffleQueue.length === 0) return;
    const idx = shuffleQueue[0];
    shuffleQueue = shuffleQueue.slice(1);
    loadTrack(tracks[idx]);
  }

  function playRandom() {
    shuffleMode = true;
    shuffleQueue = buildShuffleQueue();
    playNextShuffle();
  }

  function seekToArm() {
    if (!player || !playerReady) return;
    playFromProgress(player, angleToProgress(tonearmAngle), volume, playRange);
  }

  function pause() {
    player?.pauseVideo();
  }

  function getPlaybackProgress(): number | null {
    if (!player || !playerReady) return null;
    const progress = getRangeProgress(player, playRange);
    if (progress !== null && playRange.end !== null) {
      const current = player.getCurrentTime?.() ?? 0;
      if (current >= playRange.end) {
        if (shuffleMode) {
          playNextShuffle();
        } else {
          player.pauseVideo();
        }
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
</script>

<div class="page">
  <div class="ornament top-left"></div>
  <div class="ornament top-right"></div>
  <div class="ornament bottom-left"></div>
  <div class="ornament bottom-right"></div>

  <div class="main-area">
    <div id="yt-player" class="yt-hidden"></div>

    <Turntable
      bind:motorOn
      bind:armOnRecord
      bind:tonearmAngle
      bind:volume
      coverUrl={currentTrack?.cover ?? ''}
      {getPlaybackProgress}
      onSeek={seekToArm}
      onPause={pause}
      onTogglePlaylist={togglePlaylist}
    />

    {#if showPlaylist && tracks.length > 0}
      <div class="playlist-panel">
        <div class="playlist-header">
          <button class="header-btn" onclick={playRandom} aria-label="Shuffle">&#x21C4;</button>
          <button class="header-btn" onclick={togglePlaylist} aria-label="Close">&times;</button>
        </div>
        <div class="playlist-list">
          {#each tracks as track (track.url)}
            <div class="track-row" class:active={currentTrack?.url === track.url}>
              <span class="track-name" use:marqueeIfOverflow>
                <span class="track-name-scroll">
                  <span class="track-name-inner">{track.groupVersion} | {track.name}</span>
                </span>
              </span>
              <button
                class="track-play"
                onclick={() => {
                  shuffleMode = false;
                  loadTrack(track);
                }}
                aria-label="Play {track.name}">&#9654;</button
              >
            </div>
          {/each}
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

  .yt-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
  }

  .main-area {
    display: flex;
    align-items: center;
    gap: 24px;
    z-index: 1;
  }

  /* Playlist panel */
  .playlist-panel {
    width: 240px;
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
    justify-content: flex-end;
  }

  .header-btn {
    background: none;
    border: none;
    color: rgba(212, 175, 55, 0.4);
    font-size: 14px;
    cursor: pointer;
    padding: 2px 6px;
  }

  .header-btn:hover {
    color: rgba(212, 175, 55, 0.8);
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
    color: rgba(212, 175, 55, 0.6);
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
    color: rgba(212, 175, 55, 0.4);
    font-size: 10px;
    cursor: pointer;
    padding: 2px 4px;
  }

  .track-play:hover {
    color: rgba(212, 175, 55, 0.8);
  }

  @media (max-width: 768px) {
    .playlist-panel {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90vw;
      max-width: 400px;
      max-height: 70vh;
      z-index: 100;
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
