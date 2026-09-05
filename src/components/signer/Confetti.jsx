'use client';

import { useEffect, useRef } from 'react';

export default function Confetti() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W = window.innerWidth;
    let H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
    const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4'];
    const particles = Array.from({ length: 180 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H - H,
      w: Math.random() * 10 + 5,
      h: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      rotSpeed: Math.random() * 12 - 6,
      vx: Math.random() * 6 - 3,
      vy: Math.random() * 3 + 2.5,
      opacity: 1,
    }));
    let anim;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      let alive = false;
      for (const p of particles) {
        if (p.opacity <= 0) continue;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotSpeed;
        if (p.y > H + 30) p.opacity -= 0.025;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (alive) anim = requestAnimationFrame(frame);
    }
    anim = requestAnimationFrame(frame);
    function onResize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
    }
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(anim);
      window.removeEventListener('resize', onResize);
    };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 z-50 pointer-events-none" />;
}