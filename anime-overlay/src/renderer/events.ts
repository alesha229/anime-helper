// @ts-nocheck
import { addXp, saveState, updateUI } from "./timer/pomodoro";
import { toast } from "./ui/toast";
import { speakCategory } from "./voice/voice";
import { playRandomNonIdle, focusModel } from "./animations/animations";

export function initEvents() {
  if (window.overlayAPI && window.overlayAPI.onEvent) {
    const processed = new Set();
    window.overlayAPI.onEvent((data: any) => {
      try {
        if (!data || !data.type) return;
        const key = [
          data.type,
          data.path || "",
          data.timestamp || "",
        ].join("|");
        if (processed.has(key)) return;
        processed.add(key);

        if (data.type === "save") {
          const chars = typeof data.chars === "number" ? data.chars : 0;
          let gain = 0;
          if (chars > 0) gain = Math.max(1, Math.ceil(chars / 10));
          if (gain > 0) {
            addXp(gain);
            toast("Сохранено: +" + gain + " XP (" + chars + " chars)");
            speakCategory("xp");
            playRandomNonIdle();
          } else {
            // no XP for zero-chars save
            toast("Сохранено (без XP)");
          }
        } else if (data.type === "edit") {
          // edits don't grant XP until saved; just react
          saveState();
          updateUI();
          toast("Правка");
          playRandomNonIdle();
          if (Math.random() < 0.1) speakCategory("fun");
        } else if (data.type === "focus") {
          focusModel();
          toast("Фокус на файле");
        }
      } catch (e) {
        console.error("onEvent handler", e);
      }
    });
  }
}
