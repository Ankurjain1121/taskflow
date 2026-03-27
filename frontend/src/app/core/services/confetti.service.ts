import { Injectable } from '@angular/core';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  rotation: number;
  rotationSpeed: number;
}

@Injectable({ providedIn: 'root' })
export class ConfettiService {
  private readonly colors = [
    '#A0663E',
    '#2E7D2B',
    '#C62828',
    '#2D5BE3',
    '#9A6A08',
    '#6E3482',
    '#0C8A6B',
  ];

  fire(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '99999';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      canvas.remove();
      return;
    }

    const particleCount = 80 + Math.floor(Math.random() * 21); // 80-100
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height / 2 - 100,
        vx: (Math.random() - 0.5) * 12,
        vy: -(Math.random() * 10 + 4),
        size: 4 + Math.random() * 4,
        color: this.colors[Math.floor(Math.random() * this.colors.length)],
        alpha: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
      });
    }

    const gravity = 0.25;
    const fadeRate = 0.012;
    const startTime = performance.now();
    const duration = 2500;

    const animate = (now: number): void => {
      const elapsed = now - startTime;
      if (elapsed > duration) {
        canvas.remove();
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.vy += gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha = Math.max(0, p.alpha - fadeRate);
        p.rotation += p.rotationSpeed;

        if (p.alpha <= 0) continue;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }
}
