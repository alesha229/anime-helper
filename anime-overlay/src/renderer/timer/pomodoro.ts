// @ts-nocheck
import { speakCategory } from "../voice/voice";
import { interruptAndPlayRandomNonIdle, pulseModel } from "../animations/animations";
import { toast } from "../ui/toast";
import { getModel } from "../modelStore";

const stateKey = "anime_overlay_rpg_v1";
let state = { level: 1, xp: 0, tomatoes: 0 };
const TIMER_WORK_DEFAULT = 25 * 60;
const TIMER_BREAK_DEFAULT = 5 * 60;
let workDuration = TIMER_WORK_DEFAULT;
let breakDuration = TIMER_BREAK_DEFAULT;
let timeLeft = workDuration;
let running = false;
let mode = "work"; // 'work' or 'break'
let timerInterval: any = null;

let timerDisplay: HTMLElement;
let timerLabel: HTMLElement;
let startBtn: HTMLButtonElement;
let pauseBtn: HTMLButtonElement;
let resetBtn: HTMLButtonElement;
let levelEl: HTMLElement;
let xpEl: HTMLElement;
let tomatoesEl: HTMLElement;

export function initPomodoro() {
  try {
    const saved = localStorage.getItem(stateKey);
    if (saved) state = JSON.parse(saved);
  } catch (e) {}

  const $ = (id: string) => document.getElementById(id);
  timerDisplay = $("timerDisplay") as HTMLElement;
  timerLabel = $("timerLabel") as HTMLElement;
  startBtn = $("startBtn") as HTMLButtonElement;
  pauseBtn = $("pauseBtn") as HTMLButtonElement;
  resetBtn = $("resetBtn") as HTMLButtonElement;
  levelEl = $("level") as HTMLElement;
  xpEl = $("xp") as HTMLElement;
  tomatoesEl = $("tomatoes") as HTMLElement;

  if (startBtn) startBtn.addEventListener("click", startTimer);
  if (pauseBtn) pauseBtn.addEventListener("click", pauseTimer);
  if (resetBtn) resetBtn.addEventListener("click", resetTimer);

  // clicks on model grant small XP
  const modelDiv = $("model");
  if (modelDiv) {
    modelDiv.addEventListener("click", () => {
      state.xp += 1;
      saveState();
      updateUI();
      toast("+1 XP");
    });
  }

  timeLeft = workDuration;
  updateUI();
  if (pauseBtn) pauseBtn.disabled = true;
  if (startBtn) startBtn.disabled = false;
}

export function saveState() {
  try {
    localStorage.setItem(stateKey, JSON.stringify(state));
  } catch (e) {}
}

export function addXp(amount: number) {
    state.xp += amount;
    saveState();
    updateUI();
}

function formatTime(s: number) {
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return (
    String(mm).padStart(2, "0") + ":" + String(ss).padStart(2, "0")
  );
}

export function updateUI() {
  if (timerDisplay) timerDisplay.textContent = formatTime(timeLeft);
  if (timerLabel) timerLabel.textContent = mode === "work" ? "Работа" : "Перерыв";
  if (levelEl) levelEl.textContent = String(state.level);
  if (xpEl) xpEl.textContent = String(state.xp);
  if (tomatoesEl) tomatoesEl.textContent = String(state.tomatoes);
}

function rewardForWork() {
  state.xp += 10;
  state.tomatoes += 1;
  if (state.xp >= state.level * 100) {
    state.xp -= state.level * 100;
    state.level += 1; // level up
    // celebration animation
    pulseModel(1.3, 600);
    toast("Уровень повышен!");
    speakCategory("xp");
  } else {
    pulseModel(1.1, 400);
  }
  saveState();
  updateUI();
}

function startTimer() {
  if (running) return;
  running = true;
  if (startBtn) startBtn.disabled = true;
  if (pauseBtn) pauseBtn.disabled = false;
  // no model zoom on timer start
  speakCategory("start");
  // ensure animation triggers even if audio is blocked
  interruptAndPlayRandomNonIdle();
  timerInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      running = false;
      if (startBtn) startBtn.disabled = false;
      if (pauseBtn) pauseBtn.disabled = true;
      completeSession();
    }
    updateUI();
  }, 1000);
}

function pauseTimer() {
  if (!running) return;
  running = false;
  clearInterval(timerInterval);
  if (startBtn) startBtn.disabled = false;
  if (pauseBtn) pauseBtn.disabled = true;
  speakCategory("break");
  interruptAndPlayRandomNonIdle();
}

function resetTimer() {
  pauseTimer();
  mode = "work";
  workDuration = TIMER_WORK_DEFAULT;
  breakDuration = TIMER_BREAK_DEFAULT;
  timeLeft = workDuration;
  updateUI();
}

function completeSession() {
  if (mode === "work") {
    rewardForWork();
    mode = "break";
    timeLeft = breakDuration;
    toast("Перерыв!"); // model reaction
    speakCategory("break");
    try {
      const m = getModel();
      if (
        m &&
        m.internalModel &&
        m.internalModel.motionManager &&
        m.internalModel.motionManager.startRandomMotion
      )
        m.internalModel.motionManager.startRandomMotion("Relax");
    } catch (e) {}
  } else {
    mode = "work";
    timeLeft = workDuration;
    toast("Время работать!");
    speakCategory("finish");
  }
  updateUI();
}
