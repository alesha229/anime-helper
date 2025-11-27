// @ts-nocheck
import { getModel } from "../modelStore";
import { getLipSyncState, setLipSyncState } from "./lipsyncState";

export function setMouthOpenParam(value: number) {
  const targetModel = getModel();
  if (!targetModel) return false;
  const v = Math.max(0, Math.min(1, value));
  // Try Cubism4 core
  try {
    const core =
      targetModel.internalModel && targetModel.internalModel.coreModel;
    if (core) {
      if (typeof core.setParameterById === "function") {
        core.setParameterById("ParamMouthOpenY", v);
        return true;
      }
      if (typeof core.setParameterValueById === "function") {
        core.setParameterValueById("ParamMouthOpenY", v);
        return true;
      }
      if (
        typeof core.getParameterIndexById === "function" &&
        typeof core.setParameterValueByIndex === "function"
      ) {
        const idx = core.getParameterIndexById("ParamMouthOpenY");
        if (idx >= 0) {
          core.setParameterValueByIndex(idx, v);
          return true;
        }
      }
    }
  } catch (e) {}
  // Try Cubism2 API
  try {
    const c2 =
      (targetModel.internalModel &&
        targetModel.internalModel.coreModel) ||
      targetModel;
    if (c2 && typeof c2.setParamFloat === "function") {
      c2.setParamFloat("PARAM_MOUTH_OPEN_Y", v);
      return true;
    }
  } catch (e) {}
  // Some wrappers might expose direct method
  try {
    if (typeof targetModel.setParamFloat === "function") {
      targetModel.setParamFloat("PARAM_MOUTH_OPEN_Y", v);
      return true;
    }
  } catch (e) {}
  return false;
}

export function ensureAudioContext() {
  try {
    const AudioCtx =
      window.AudioContext || (window as any).webkitAudioContext || null;
    if (!AudioCtx) return null;
    // Lazy init: try create now
    const lipSyncState = getLipSyncState();
    if (!lipSyncState.audioContext) {
      try {
        lipSyncState.audioContext = new AudioCtx();
      } catch {
        lipSyncState.audioContext = null;
      }
      setLipSyncState(lipSyncState);
    }

    const ctx = getLipSyncState().audioContext;
    if (!ctx) {
      // Retry on first user gesture
      const retry = () => {
        try {
          const lipSyncState = getLipSyncState();
          lipSyncState.audioContext = new AudioCtx();
          setLipSyncState(lipSyncState);
        } catch {}
        window.removeEventListener("pointerdown", retry);
        window.removeEventListener("touchstart", retry);
      };
      window.addEventListener("pointerdown", retry, { once: true });
      window.addEventListener("touchstart", retry, { once: true });
      return null;
    }
    // If suspended, try resume
    try {
      if ((ctx as any).state === "suspended") {
        (ctx as any).resume();
      }
    } catch {}
    return getLipSyncState().audioContext;
  } catch {
    return null;
  }
}

export function startLipSyncForAudio(audioEl: HTMLAudioElement) {
  const model = getModel();
  if (!audioEl || !model) return;
  const ctx = ensureAudioContext();
  if (!ctx) return;
  try {
    if (getLipSyncState().source && getLipSyncState().source.disconnect)
      getLipSyncState().source.disconnect();
  } catch (e) {}
  try {
    const source = ctx.createMediaElementSource(audioEl);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    const data = new Uint8Array(analyser.fftSize);
    source.connect(analyser);
    analyser.connect(ctx.destination);
    const lipSyncState = getLipSyncState();
    lipSyncState.source = source;
    lipSyncState.analyser = analyser;
    lipSyncState.data = data;
    setLipSyncState(lipSyncState);
    const update = () => {
      if (!getLipSyncState().lipSyncEnabled) return;
      try {
        analyser.getByteTimeDomainData(data);
        let min = 255,
          max = 0;
        for (let i = 0; i < data.length; i++) {
          const v = data[i];
          if (v < min) min = v;
          if (v > max) max = v;
        }
        let amp = (max - min) / 255;
        amp = Math.pow(Math.max(0, amp - 0.02) * 1.8, 1.2);
        if (amp > 1) amp = 1;
        setMouthOpenParam(amp);
      } catch (e) {}
      if (audioEl.ended || audioEl.paused) {
        setMouthOpenParam(0);
        return;
      }
      const lipSyncState = getLipSyncState();
      lipSyncState.raf = requestAnimationFrame(update);
      setLipSyncState(lipSyncState);
    };
    const lipSyncStateUpdated = getLipSyncState();
    lipSyncStateUpdated.lipSyncEnabled = true;
    lipSyncStateUpdated.raf = requestAnimationFrame(update);
    setLipSyncState(lipSyncStateUpdated);
  } catch (e) {}
}

export async function startLipSync() {
  const model = getModel();
  if (!window.navigator || !navigator.mediaDevices) return;
  if (!model) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    const AudioCtx =
      window.AudioContext || (window as any).webkitAudioContext || null;
    if (!AudioCtx) return;
    const audioContext = new AudioCtx();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    const data = new Uint8Array(analyser.fftSize);
    source.connect(analyser);
    const lipSyncState = getLipSyncState();
    lipSyncState.stream = stream;
    lipSyncState.audioContext = audioContext;
    lipSyncState.source = source;
    lipSyncState.analyser = analyser;
    lipSyncState.data = data;
    lipSyncState.raf = null;
    setLipSyncState(lipSyncState);

    const update = () => {
      if (!getLipSyncState().lipSyncEnabled) return;
      try {
        analyser.getByteTimeDomainData(data);
        // Compute peak-to-peak amplitude normalized
        let min = 255,
          max = 0;
        for (let i = 0; i < data.length; i++) {
          const v = data[i];
          if (v < min) min = v;
          if (v > max) max = v;
        }
        let amp = (max - min) / 255; // 0..~1
        // Smooth and scale
        amp = Math.pow(Math.max(0, amp - 0.02) * 1.8, 1.2);
        if (amp > 1) amp = 1;
        setMouthOpenParam(amp);
      } catch (e) {}
      const lipSyncState = getLipSyncState();
      lipSyncState.raf = requestAnimationFrame(update);
      setLipSyncState(lipSyncState);
    };
    const lipSyncStateUpdated = getLipSyncState();
    lipSyncStateUpdated.lipSyncEnabled = true;
    setLipSyncState(lipSyncStateUpdated);

    update();
  } catch (e) {}
}

export function stopLipSync() {
  try {
    if (getLipSyncState() && getLipSyncState().raf != null) {
      cancelAnimationFrame(getLipSyncState().raf as any);
      const lipSyncState = getLipSyncState();
      lipSyncState.raf = null;
      setLipSyncState(lipSyncState);
    }
  } catch (e) {}
  try {
    if (
      getLipSyncState() &&
      getLipSyncState().source &&
      getLipSyncState().source.disconnect
    ) {
      getLipSyncState().source.disconnect();
    }
  } catch (e) {}
  try {
    if (getLipSyncState() && getLipSyncState().stream) {
      getLipSyncState()
        .stream.getTracks()
        .forEach((t: any) => t.stop());
    }
  } catch (e) {}
  try {
    setMouthOpenParam(0);
  } catch (e) {}
}
