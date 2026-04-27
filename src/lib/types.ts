export interface Track {
  url: string;
  name: string;
  version?: string;
  cover?: string;
  /** Start time in seconds (default: 0) */
  start?: number;
  /** End time in seconds (default: full duration) */
  end?: number;
}

export interface TrackGroup {
  version: string;
  cover?: string;
  tracks: Track[];
}
