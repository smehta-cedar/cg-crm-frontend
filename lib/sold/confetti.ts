// Bursts out of the popup's center toward all four corners of the page
export function confetti(canvas: HTMLCanvasElement, dialog: HTMLElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  if (canvas.matches(":popover-open")) canvas.hidePopover();
  canvas.showPopover();
  const colors = ["#1f7f5f", "#3bb38f", "#71bb66", "#f5c542", "#ff7a59", "#4aa3ff", "#e85d9a"];
  const box = dialog.getBoundingClientRect();
  const cx = box.left + box.width / 2,
    cy = box.top + box.height / 2;
  const corners = [
    [0, 0],
    [innerWidth, 0],
    [0, innerHeight],
    [innerWidth, innerHeight],
  ].map(([x, y]) => Math.atan2(y - cy, x - cx));
  const pieces = Array.from({ length: 200 }, (_, i) => {
    const angle = corners[i % 4] + (Math.random() - 0.5) * 1.4; // fan out around each corner
    const speed = 8 + Math.random() * 16;
    return {
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: 14 + Math.random() * 10,
      h: 18 + Math.random() * 14,
      spin: Math.random() * Math.PI,
      vspin: (Math.random() - 0.5) * 0.3,
      color: colors[i % colors.length],
    };
  });
  const start = performance.now();
  (function frame(now: number) {
    const t = now - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalAlpha = t < 2600 ? 1 : Math.max(0, 1 - (t - 2600) / 800);
    pieces.forEach((p) => {
      p.vy += 0.15;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.spin += p.vspin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.spin)));
      ctx.restore();
    });
    if (t < 3400) requestAnimationFrame(frame);
    else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.hidePopover();
    }
  })(start);
}
