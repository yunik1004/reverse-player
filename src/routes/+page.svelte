<script lang="ts">
  import { onMount } from 'svelte';
  import Turntable from '$lib/components/Turntable.svelte';
  import { angleToProgress, progressToAngle } from '$lib/tonearm';
  import { extractVideoId, initYouTubeAPI, playFromProgress } from '$lib/youtube';

  let volume = $state(100);
  let urlInput = $state('');
  let player = $state.raw<YT.Player | null>(null);
  let playerReady = $state(false);
  let motorOn = $state(false);
  let armOnRecord = $state(false);
  let tonearmAngle = $state(progressToAngle(0));

  onMount(async () => {
    player = await initYouTubeAPI('yt-player', {
      onReady: () => {
        playerReady = true;
      },
      onEnded: () => {
        player?.pauseVideo();
      }
    });
  });

  function loadVideo() {
    const id = extractVideoId(urlInput);
    if (!id || !player) return;
    player.cueVideoById(id);
    player.setVolume(volume);
  }

  function seekToArm() {
    if (!player || !playerReady) return;
    playFromProgress(player, angleToProgress(tonearmAngle), volume, extractVideoId);
  }

  function pause() {
    player?.pauseVideo();
  }

  function getPlaybackProgress(): number | null {
    if (!player || !playerReady) return null;
    const duration = player.getDuration?.() ?? 0;
    if (duration <= 0) return null;
    return Math.min(1, (player.getCurrentTime?.() ?? 0) / duration);
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

  <div class="url-bar">
    <input
      type="text"
      class="url-input"
      placeholder="YouTube URL"
      bind:value={urlInput}
      onkeydown={(e) => e.key === 'Enter' && loadVideo()}
    />
    <button class="url-btn" onclick={loadVideo}>LOAD</button>
  </div>

  <div id="yt-player" class="yt-hidden"></div>

  <Turntable
    bind:motorOn
    bind:armOnRecord
    bind:tonearmAngle
    bind:volume
    {getPlaybackProgress}
    onSeek={seekToArm}
    onPause={pause}
  />
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

  .url-bar {
    display: flex;
    gap: 8px;
    z-index: 10;
  }

  .url-input {
    width: 320px;
    padding: 8px 14px;
    background: #0e0b08;
    border: 1px solid rgba(60, 42, 22, 0.5);
    border-radius: 4px;
    color: rgba(212, 175, 55, 0.7);
    font-family: 'Cinzel', serif;
    font-size: 11px;
    letter-spacing: 0.05em;
    outline: none;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.5);
  }

  .url-input::placeholder {
    color: rgba(212, 175, 55, 0.25);
  }
  .url-input:focus {
    border-color: rgba(212, 175, 55, 0.3);
  }

  .url-btn {
    padding: 8px 16px;
    background: linear-gradient(180deg, #2a2016, #1e1810);
    border: 1px solid rgba(60, 42, 22, 0.5);
    border-radius: 4px;
    color: rgba(212, 175, 55, 0.6);
    font-family: 'Cinzel', serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.15em;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  }

  .url-btn:hover {
    border-color: rgba(212, 175, 55, 0.4);
    color: rgba(212, 175, 55, 0.8);
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
