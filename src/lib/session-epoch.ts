let epoch = 0;
export function sessionEpoch() {
  return epoch;
}
export function advanceSessionEpoch() {
  return ++epoch;
}
export function requireCurrentSession(started: number) {
  if (started !== epoch) throw new Error("Your account changed. Please try again.");
}
