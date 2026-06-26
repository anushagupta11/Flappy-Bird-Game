import { Background } from "./Background";

export interface Obstacle {
  x: number;
  width: number;
  topHeight: number;
  bottomHeight: number;
  passed: boolean;
}

export interface Worm {
  x: number;
  y: number;
  radius: number;
  collected: boolean;
  wiggleOffset: number;
  points: number;
}

export type PestType = "bee" | "ladybug";

export interface Pest {
  x: number;
  y: number;
  radius: number;
  type: PestType;
  speedX: number;
  speedY: number;
  wiggleAmount: number;
  wingTimer: number;
}

export class ObstacleManager {
  private pipes: Obstacle[] = [];
  private worms: Worm[] = [];
  private pests: Pest[] = [];

  private spawnTimer = 0;
  private pestSpawnTimer = 0;
  private canvasWidth = 0;
  private canvasHeight = 0;

  // Configuration
  private readonly pipeWidth = 75;
  private readonly spawnInterval = 110; // Frames or tick based spawning threshold
  private readonly minPipeHeight = 50;
  private readonly baseGap = 175; // Initial vertical gap in pixels
  private readonly minGap = 135;  // Minimum gap as score increases

  constructor(width: number, height: number) {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  public reset(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.pipes = [];
    this.worms = [];
    this.pests = [];
    this.spawnTimer = 0;
    this.pestSpawnTimer = 0;
  }

  public update(speed: number, score: number, deltaTime: number): void {
    const dt = deltaTime / 16.666;

    // 1. Update existing pipes
    this.pipes.forEach(pipe => {
      pipe.x -= speed * dt;
    });

    // Remove offscreen pipes
    this.pipes = this.pipes.filter(pipe => pipe.x + pipe.width > -50);

    // 2. Update existing worms
    this.worms.forEach(worm => {
      worm.x -= speed * dt;
      // Wiggle animation
      worm.wiggleOffset += 0.1 * dt;
    });
    this.worms = this.worms.filter(worm => worm.x + worm.radius > -50 && !worm.collected);

    // 3. Update existing pests
    this.pests.forEach(pest => {
      pest.x -= (speed + pest.speedX) * dt;
      // Sine wave vertical movement
      pest.y += Math.sin(pest.wiggleAmount) * pest.speedY * dt;
      pest.wiggleAmount += 0.08 * dt;
      pest.wingTimer += 0.3 * dt;
    });
    this.pests = this.pests.filter(pest => pest.x + pest.radius > -50);

    // 4. Spawning logic for Pipes & Worms
    this.spawnTimer += 1 * dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnPipePair(score);
    }

    // 5. Spawning logic for Pests (bees and ladybugs)
    // Spawns randomly in the sky/gap area, but not too frequently
    this.pestSpawnTimer += 1 * dt;
    const pestSpawnRate = Math.max(160, 320 - score * 5); // Spawns faster as score increases
    if (this.pestSpawnTimer >= pestSpawnRate) {
      this.pestSpawnTimer = 0;
      this.spawnPest();
    }
  }

  private spawnPipePair(score: number): void {
    const floorY = this.canvasHeight - Background.FLOOR_HEIGHT;
    
    // Scale gap size with score (narrower gap = higher difficulty)
    const gap = Math.max(this.minGap, this.baseGap - score * 0.8);
    
    // Calculate total height space for pipes
    const playableHeight = floorY - gap;
    const maxHeight = playableHeight - this.minPipeHeight;
    const topHeight = this.minPipeHeight + Math.random() * (maxHeight - this.minPipeHeight);
    const bottomHeight = floorY - topHeight - gap;

    const pipeX = this.canvasWidth + 20;

    this.pipes.push({
      x: pipeX,
      width: this.pipeWidth,
      topHeight,
      bottomHeight,
      passed: false
    });

    // Spawn a worm inside the gap 65% of the time, or outside 20%
    const rand = Math.random();
    if (rand < 0.65) {
      // Spawn worm centered inside the pipe gap
      this.worms.push({
        x: pipeX + this.pipeWidth / 2,
        y: topHeight + gap / 2,
        radius: 10,
        collected: false,
        wiggleOffset: Math.random() * 100,
        points: 5 // Bonus points for worms!
      });
    } else if (rand < 0.85) {
      // Spawn floating worm above or below the gap
      const wormY = 50 + Math.random() * (floorY - 100);
      this.worms.push({
        x: pipeX + this.pipeWidth + 80,
        y: wormY,
        radius: 10,
        collected: false,
        wiggleOffset: Math.random() * 100,
        points: 5
      });
    }
  }

  private spawnPest(): void {
    const floorY = this.canvasHeight - Background.FLOOR_HEIGHT;
    
    // Y coordinates safe for the sky/center zones
    const pestY = 80 + Math.random() * (floorY - 160);
    const type: PestType = Math.random() > 0.5 ? "bee" : "ladybug";

    // Set dynamic properties
    const speedX = 0.5 + Math.random() * 1.5; // moves slightly faster than pipes
    const speedY = type === "bee" ? 1.2 : 0.4; // bees wiggle up and down more
    
    this.pests.push({
      x: this.canvasWidth + 50,
      y: pestY,
      radius: 12,
      type,
      speedX,
      speedY,
      wiggleAmount: Math.random() * Math.PI * 2,
      wingTimer: Math.random() * 10
    });
  }

  /* ==========================================================================
     Draw Functions
     ========================================================================== */

  public draw(ctx: CanvasRenderingContext2D): void {
    // 1. Draw Pipes
    this.pipes.forEach(pipe => {
      this.drawPipe(ctx, pipe);
    });

    // 2. Draw Worms
    this.worms.forEach(worm => {
      this.drawWorm(ctx, worm);
    });

    // 3. Draw Pests
    this.pests.forEach(pest => {
      this.drawPest(ctx, pest);
    });
  }

  private drawPipe(ctx: CanvasRenderingContext2D, pipe: Obstacle): void {
    const floorY = this.canvasHeight - Background.FLOOR_HEIGHT;
    const lipHeight = 22;
    const lipWidthOffset = 4;

    // Top Pipe
    this.drawSinglePipe(ctx, pipe.x, 0, pipe.width, pipe.topHeight, true, lipHeight, lipWidthOffset);

    // Bottom Pipe
    const bottomPipeY = floorY - pipe.bottomHeight;
    this.drawSinglePipe(ctx, pipe.x, bottomPipeY, pipe.width, pipe.bottomHeight, false, lipHeight, lipWidthOffset);
  }

  private drawSinglePipe(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    isTop: boolean,
    lipH: number,
    lipWOffset: number
  ): void {
    // Draw base pipe column
    const colX = x;
    const colW = w;
    const colY = isTop ? y : y + lipH;
    const colH = isTop ? h - lipH : h - lipH;

    // Pipe Gradient (Mossy stone pillars or metal pipes theme)
    const pipeGrad = ctx.createLinearGradient(colX, 0, colX + colW, 0);
    pipeGrad.addColorStop(0, "#065f46"); // Deep emerald green
    pipeGrad.addColorStop(0.2, "#059669"); // Highlight green
    pipeGrad.addColorStop(0.5, "#10b981"); // Bright emerald green
    pipeGrad.addColorStop(0.8, "#047857"); // Dark green shadow
    pipeGrad.addColorStop(1, "#064e3b"); // Deep shadow

    ctx.fillStyle = pipeGrad;
    ctx.fillRect(colX, colY, colW, colH);

    // Subtle outline / structure borders
    ctx.strokeStyle = "#022c22";
    ctx.lineWidth = 2;
    ctx.strokeRect(colX, colY, colW, colH);

    // Draw Lip (the wider rim at the end of the pipe)
    const lipX = x - lipWOffset;
    const lipW = w + lipWOffset * 2;
    const lipY = isTop ? h - lipH : y;

    const lipGrad = ctx.createLinearGradient(lipX, 0, lipX + lipW, 0);
    lipGrad.addColorStop(0, "#047857");
    lipGrad.addColorStop(0.2, "#10b981");
    lipGrad.addColorStop(0.5, "#34d399"); // Lighter rim highlight
    lipGrad.addColorStop(0.8, "#059669");
    lipGrad.addColorStop(1, "#064e3b");

    ctx.fillStyle = lipGrad;
    ctx.fillRect(lipX, lipY, lipW, lipH);
    ctx.strokeRect(lipX, lipY, lipW, lipH);

    // Draw some simple pipe lines/ribs for arcade look
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(colX + 8, colY);
    ctx.lineTo(colX + 8, colY + colH);
    ctx.moveTo(colX + 18, colY);
    ctx.lineTo(colX + 18, colY + colH);
    ctx.stroke();
  }

  private drawWorm(ctx: CanvasRenderingContext2D, worm: Worm): void {
    ctx.save();
    ctx.translate(worm.x, worm.y);

    // Wiggle offset rotation
    const wiggle = Math.sin(worm.wiggleOffset * Math.PI) * 0.12;
    ctx.rotate(wiggle);

    // Pink worm body (drawn with multiple overlapping circles)
    const segmentCount = 4;
    const segmentRadius = 6;
    ctx.fillStyle = "#f472b6"; // Bright pink

    // Draw shadow underneath
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    for (let i = 0; i < segmentCount; i++) {
      const segX = -10 + i * 7;
      const segY = Math.sin(worm.wiggleOffset * 1.5 + i) * 3 + 2;
      ctx.beginPath();
      ctx.arc(segX, segY, segmentRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw pink segments
    for (let i = 0; i < segmentCount; i++) {
      ctx.fillStyle = i === segmentCount - 1 ? "#fca5a5" : "#f472b6"; // Head slightly lighter pink
      const segX = -10 + i * 7;
      const segY = Math.sin(worm.wiggleOffset * 1.5 + i) * 3;
      ctx.beginPath();
      ctx.arc(segX, segY, segmentRadius, 0, Math.PI * 2);
      ctx.fill();

      // Eyes on the head segment
      if (i === segmentCount - 1) {
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.arc(segX + 2, segY - 2, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw a small shining sparkle above the worm to make it stand out
    const shine = Math.sin(worm.wiggleOffset * 2.0);
    if (shine > 0) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.beginPath();
      ctx.arc(4, -12, 2 * shine, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawPest(ctx: CanvasRenderingContext2D, pest: Pest): void {
    ctx.save();
    ctx.translate(pest.x, pest.y);

    if (pest.type === "bee") {
      this.drawBee(ctx, pest);
    } else {
      this.drawLadybug(ctx, pest);
    }

    ctx.restore();
  }

  private drawBee(ctx: CanvasRenderingContext2D, pest: Pest): void {
    // 1. Wings (flapping rapidly)
    const wingFlap = Math.sin(pest.wingTimer) * 10;
    ctx.fillStyle = "rgba(200, 240, 255, 0.6)";
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1;
    
    // Left Wing
    ctx.save();
    ctx.translate(-2, -5);
    ctx.rotate(-0.8 + wingFlap * 0.05);
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Right Wing
    ctx.save();
    ctx.translate(2, -5);
    ctx.rotate(0.8 - wingFlap * 0.05);
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 2. Bee Body (Yellow and Black stripes)
    const r = pest.radius;
    
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.arc(0, 2, r, 0, Math.PI * 2);
    ctx.fill();

    // Body base
    ctx.fillStyle = "#eab308"; // Golden yellow
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#854d0e";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Black stripes (clip inside ellipse)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.clip();
    
    ctx.fillStyle = "#1e293b"; // Dark slate stripes
    ctx.fillRect(-6, -r, 3, r * 2);
    ctx.fillRect(0, -r, 3, r * 2);
    ctx.restore();

    // Eye
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-r * 0.4, -r * 0.2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(-r * 0.5, -r * 0.2, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Stinger
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.moveTo(r * 0.8, -1);
    ctx.lineTo(r * 1.2, 0);
    ctx.lineTo(r * 0.8, 2);
    ctx.closePath();
    ctx.fill();
  }

  private drawLadybug(ctx: CanvasRenderingContext2D, pest: Pest): void {
    const r = pest.radius;

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.arc(0, 2, r, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const legX = -6 + i * 6;
      ctx.beginPath();
      ctx.moveTo(legX, 0);
      ctx.lineTo(legX, r + 2);
      ctx.stroke();
    }

    // Ladybug Red Shell
    ctx.fillStyle = "#ef4444"; // Red
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#7f1d1d";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Black Head
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(-r * 0.7, 0, r * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Spot highlights (Spots on Ladybug)
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(-r * 0.1, -r * 0.4, 2.2, 0, Math.PI * 2);
    ctx.arc(r * 0.4, -r * 0.2, 2.5, 0, Math.PI * 2);
    ctx.arc(-r * 0.2, r * 0.3, 2.2, 0, Math.PI * 2);
    ctx.arc(r * 0.3, r * 0.4, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Center shell dividing line
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, 0);
    ctx.lineTo(r, 0);
    ctx.stroke();
  }

  // Debug helper
  public drawDebug(ctx: CanvasRenderingContext2D): void {
    // Pipe bounding boxes
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1;
    this.pipes.forEach(pipe => {
      const floorY = this.canvasHeight - Background.FLOOR_HEIGHT;
      // Top pipe
      ctx.strokeRect(pipe.x, 0, pipe.width, pipe.topHeight);
      // Bottom pipe
      ctx.strokeRect(pipe.x, floorY - pipe.bottomHeight, pipe.width, pipe.bottomHeight);
    });

    // Worms circles
    ctx.strokeStyle = "#3b82f6";
    this.worms.forEach(worm => {
      ctx.beginPath();
      ctx.arc(worm.x, worm.y, worm.radius, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Pests circles
    ctx.strokeStyle = "#eab308";
    this.pests.forEach(pest => {
      ctx.beginPath();
      ctx.arc(pest.x, pest.y, pest.radius, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  /* ==========================================================================
     Getters / Data methods
     ========================================================================== */

  public getPipes(): Obstacle[] {
    return this.pipes;
  }

  public getWorms(): Worm[] {
    return this.worms;
  }

  public getPests(): Pest[] {
    return this.pests;
  }
}
