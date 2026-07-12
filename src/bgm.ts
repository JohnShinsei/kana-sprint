export type BgmTrackId = 'rush' | 'focus' | 'night';

export type BgmTrack = {
  id: BgmTrackId;
  titleKey: 'bgmRush' | 'bgmFocus' | 'bgmNight';
  source: number;
};

export const BGM_TRACKS: BgmTrack[] = [
  {
    id: 'rush',
    titleKey: 'bgmRush',
    source: require('../assets/bgm/dojo_rush_loop.wav'),
  },
  {
    id: 'focus',
    titleKey: 'bgmFocus',
    source: require('../assets/bgm/neon_focus_loop.wav'),
  },
  {
    id: 'night',
    titleKey: 'bgmNight',
    source: require('../assets/bgm/starline_night_loop.wav'),
  },
];
