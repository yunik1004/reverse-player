<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import Turntable from '$lib/components/Turntable.svelte';
  import { angleToProgress, progressToAngle } from '$lib/tonearm';
  import {
    extractVideoId,
    initYouTubeAPI,
    playFromProgress,
    getRangeProgress,
    type PlayRange
  } from '$lib/youtube';
  import type { Track } from '$lib/types';

  let volume = $state(100);
  let player = $state.raw<YT.Player | null>(null);
  let playerReady = $state(false);
  let motorOn = $state(false);
  let armOnRecord = $state(false);
  let tonearmAngle = $state(progressToAngle(0));

  let playlist = $state<Track[]>([]);
  let checked = new SvelteSet<number>();
  let currentTrack = $state<Track | null>(null);
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
      playlist = await res.json();
      playlist.forEach((_, i) => checked.add(i));
    }
  });

  function loadTrack(track: Track) {
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
    const indices = [...checked];
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
    loadTrack(playlist[idx]);
  }

  function playRandom() {
    shuffleMode = true;
    shuffleQueue = buildShuffleQueue();
    playNextShuffle();
  }

  function toggleCheck(index: number) {
    if (checked.has(index)) checked.delete(index);
    else checked.add(index);
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

    {#if showPlaylist && playlist.length > 0}
      <div class="playlist-panel">
        <div class="playlist-header">
          <button class="header-btn" onclick={playRandom} aria-label="Shuffle">&#x21C4;</button>
          <button class="header-btn" onclick={togglePlaylist} aria-label="Close">&times;</button>
        </div>
        <div class="playlist-list">
          {#each playlist as track, i (track.url)}
            <div class="track-row" class:active={currentTrack?.url === track.url}>
              <label class="track-check">
                <input type="checkbox" checked={checked.has(i)} onchange={() => toggleCheck(i)} />
              </label>
              <span class="track-name">{track.name}</span>
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

  .track-check {
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .track-check input {
    accent-color: #d4af37;
    width: 12px;
    height: 12px;
    cursor: pointer;
  }

  .track-name {
    flex: 1;
    font-family: 'Cinzel', serif;
    font-size: 9px;
    color: rgba(212, 175, 55, 0.6);
    letter-spacing: 0.03em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
