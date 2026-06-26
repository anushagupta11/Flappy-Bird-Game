interface GameParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  gravity: number;
  friction: number;
  shape: "circle" | "feather" | "star";
  rotation?: number;
  rotationSpeed?: number;
}

export class ParticleSystem {
  private particles: GameParticle[] = [];

  constructor() {}

  public reset(): void {
    this.particles = [];
  }

  public spawnFeather(x: number, y: number, colorCode: "yellow" | "blue" | "red"): void {
    const count = 3 + Math.floor(Math.random() * 3);
    let color = "rgba(254, 240, 138, 0.7)"; // yellow
    if (colorCode === "blue") color = "rgba(147, 197, 253, 0.7)";
    if (colorCode === "red") color = "rgba(252, 165, 165, 0.7)";

    for (let i = 0; i < count; i++) {
      const angle = Math.PI + (Math.random() * 0.4 - 0.2); // pointing slightly downwards/backwards
      const speed = 1.0 + Math.random() * 2.0;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed - 1.0, // blow backwards slightly
        vy: Math.sin(angle) * speed + 0.5,
        color,
        size: 3 + Math.random() * 5,
        alpha: 1.0,
        life: 0,
        maxLife: 30 + Math.random() * 20,
        gravity: 0.05,
        friction: 0.98,
        shape: "feather",
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.1,
      });
    }
  }

  public spawnWormSparkles(x: number, y: number): void {
    const count = 12 + Math.floor(Math.random() * 6);
    // Mix of pink, gold, and white sparkle particles
    const colors = [
      "rgba(244, 114, 182, 0.9)", // pink
      "rgba(251, 207, 232, 0.9)", // light pink
      "rgba(250, 204, 21, 0.9)",  // gold/yellow
      "rgba(255, 255, 255, 0.9)", // white
    ];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 4,
        alpha: 1.0,
        life: 0,
        maxLife: 25 + Math.random() * 15,
        gravity: -0.02, // float upwards slightly
        friction: 0.94, // decelerate fast
        shape: Math.random() > 0.5 ? "star" : "circle",
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
      });
    }
  }

  public spawnCrashBurst(x: number, y: number, skinColor: "yellow" | "blue" | "red"): void {
    const count = 25 + Math.floor(Math.random() * 10);
    let mainColor = "#facc15";
    let detailColor = "#f97316"; // orange beak color

    if (skinColor === "blue") {
      mainColor = "#3b82f6";
      detailColor = "#1d4ed8";
    } else if (skinColor === "red") {
      mainColor = "#ef4444";
      detailColor = "#b91c1c";
    }

    const colors = [
      mainColor,
      detailColor,
      "#ffffff", // eyes
      "#475569", // dark impact dust
      "rgba(0, 0, 0, 0.4)",
    ];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 6.0;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * 6,
        alpha: 1.0,
        life: 0,
        maxLife: 35 + Math.random() * 25,
        gravity: 0.15, // fall down heavily
        friction: 0.97,
        shape: "circle",
      });
    }
  }

  public update(deltaTime: number): void {
    const dt = deltaTime / 16.666;

    this.particles.forEach(p => {
      // Apply physics
      p.vy += p.gravity * dt;
      p.vx *= Math.pow(p.friction, dt);
      p.vy *= Math.pow(p.friction, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Update life
      p.life += 1 * dt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);

      if (p.rotation !== undefined && p.rotationSpeed !== undefined) {
        p.rotation += p.rotationSpeed * dt;
      }
    });

    // Clean up dead particles
    this.particles = this.particles.filter(p => p.life < p.maxLife);
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    this.particles.forEach(p => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.shape === "circle") {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === "feather") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);
        
        // Draw miniature feather leaf shape
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
      } else if (p.shape === "star") {
        // Draw small four-point sparkle star
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);
        ctx.beginPath();
        
        const size = p.size;
        ctx.moveTo(0, -size);
        ctx.quadraticCurveTo(0, 0, size, 0);
        ctx.quadraticCurveTo(0, 0, 0, size);
        ctx.quadraticCurveTo(0, 0, -size, 0);
        ctx.quadraticCurveTo(0, 0, 0, -size);
        
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    });
    ctx.restore();
  }
}
