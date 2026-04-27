export interface Track {
  url: string;
  name: string;
  version?: string;
  cover?: string;
  /** Beats per minute for dance sync */
  bpm?: number;
  /** Start time in seconds (default: 0) */
  start?: number;
  /** End time in seconds (default: full duration) */
  end?: number;
}

export interface TrackGroup {
  version: string;
  cover?: string;
  characters: string[];
  tracks: Track[];
}

export interface Character {
  name: string;
  chibi: string[];
}
