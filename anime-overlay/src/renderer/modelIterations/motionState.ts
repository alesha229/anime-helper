let motionEntries: any = [];
let availableGroups: any = [];
export function getmotionEntries() {
  return motionEntries;
}

export function setmotionEntries(state: any) {
  motionEntries = state;
}

export function getavailableGroups() {
  return availableGroups;
}

export function setavailableGroups(state: any) {
  availableGroups = state;
}
