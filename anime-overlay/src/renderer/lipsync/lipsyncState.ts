let lipSyncState = {
  stream: null,
  audioContext: null,
  source: null,
  analyser: null,
  data: null,
  raf: null,
  lipSyncEnabled: true,
};
export function getLipSyncState() {
  return lipSyncState;
}

export function setLipSyncState(state: any) {
  lipSyncState = state;
}
