// @ts-nocheck
import { getLipSyncState } from "../lipsync/lipsyncState";
import { startLipSyncForAudio } from "../lipsync/lipsync";
import { interruptAndPlayRandomNonIdle } from "../animations/animations";

let voiceEnabled = true;
let voiceMode = "audio";

export function setVoiceEnabled(enabled: boolean) {
  voiceEnabled = enabled;
}
export function getVoiceEnabled() {
  return voiceEnabled;
}
export function setVoiceMode(mode: string) {
  voiceMode = mode;
}
export function getVoiceMode() {
  return voiceMode;
}

const VOICE_AUDIO_DEFAULT = {
  start: [],
  finish: [],
  break: [],
  xp: [],
  fun: [],
};
let VOICE_AUDIO = { ...VOICE_AUDIO_DEFAULT };
const audioCache = new Map();

function getAudio(url: string) {
  let a = audioCache.get(url);
  if (!a) {
    a = new Audio(url);
    a.preload = "auto";
    audioCache.set(url, a);
  }
  return a;
}

let currentAudio: HTMLAudioElement | null = null;

export function playAudioCategory(cat: string) {
  return new Promise((resolve) => {
    try {
      const list = (VOICE_AUDIO && (VOICE_AUDIO as any)[cat]) || [];
      if (!Array.isArray(list) || !list.length) return resolve(false);
      const pick = list[Math.floor(Math.random() * list.length)];
      if (!pick) return resolve(false);
      if (currentAudio) {
        try {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        } catch (e) {}
      }
      const a = getAudio(pick);
      currentAudio = a;
      a.currentTime = 0;
      const p = a.play();
      if (p && typeof p.then === "function") {
        p.then(() => resolve(true)).catch(() => resolve(false));
      } else {
        resolve(true);
      }
    } catch (e) {
      resolve(false);
    }
  });
}

export async function loadPhrasesJson() {
  try {
    const resp = await fetch("./phrases.json", { cache: "no-cache" });
    if (!resp.ok) return;
    const data = await resp.json();
    // Accept either {cat: [audioUrls]} or {cat: {audio: [...], text: [...]}}
    const mergedAudio: any = { ...VOICE_AUDIO_DEFAULT };
    for (const k of Object.keys(mergedAudio)) {
      const v = (data as any)[k];
      if (Array.isArray(v)) {
        mergedAudio[k] = v;
      } else if (v && Array.isArray((v as any).audio)) {
        mergedAudio[k] = (v as any).audio;
      } else {
        mergedAudio[k] = [];
      }
    }
    VOICE_AUDIO = mergedAudio;
  } catch (e) {}
}

export function speakCategory(cat: string) {
  if (!voiceEnabled || !cat) return;
  playAudioCategory(cat).then((ok) => {
    if (ok && currentAudio) {
      if (getLipSyncState().lipSyncEnabled)
        startLipSyncForAudio(currentAudio);

      // trigger animation immediately on voice start
      interruptAndPlayRandomNonIdle();
      try {
        currentAudio.addEventListener(
          "play",
          () => interruptAndPlayRandomNonIdle(),
          { once: true }
        );
        currentAudio.addEventListener(
          "playing",
          () => interruptAndPlayRandomNonIdle(),
          { once: true }
        );
      } catch (e) {}
      if (!currentAudio.paused) {
        setTimeout(() => interruptAndPlayRandomNonIdle(), 0);
      }
    } else if (!ok) {
      // Нет аудио — просто запустим реакцию анимацией
      interruptAndPlayRandomNonIdle();
    }
  });
  return;
}
