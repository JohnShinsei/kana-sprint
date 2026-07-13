import { PRONUNCIATION_AUDIO, PRONUNCIATION_PACK_META } from './pronunciation.generated';

export function getPronunciationAudio(itemId: string) {
  return PRONUNCIATION_AUDIO[itemId];
}

export { PRONUNCIATION_PACK_META };
