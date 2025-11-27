export function toast(msg: string) {
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.position = "absolute";
  t.style.left = "8px";
  t.style.bottom = "8px";
  t.style.background = "rgba(0,0,0,0.6)";
  t.style.color = "white";
  t.style.padding = "6px";
  t.style.borderRadius = "6px";
  t.style.zIndex = "30";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}
