import { Bird, BirdSkin } from "./Bird";
import { Background } from "./Background";
import { ObstacleManager } from "./Obstacles";
import { ParticleSystem } from "./Particle";
import { AudioManager } from "./AudioManager";

export type GameState = "START" | "PLAYING" | "PAUSED" | "GAMEOVER";

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: GameState = "START";
  private score = 0;
  private wormsCollected = 0;
  private baseSpeed = 2.8;
  private currentSpeed = 2.8;

  // Game Objects
  private bird: Bird;
  private background: Background;
  private obstacles: ObstacleManager;
  private particles: ParticleSystem;
  private audio: AudioManager;

  // Callbacks for UI
  private onStateChange: (state: GameState, score: number, worms: number) => void;
  private onScoreUpdate: (score: number) => void;
  private onWormsUpdate: (worms: number) => void;

  // Loop tracking
  private lastTime = 0;
  private animationFrameId: number | null = null;
  private isDebugMode = false;

  constructor(
    canvas: HTMLCanvasElement,
    onStateChange: (state: GameState, score: number, worms: number) => void,
    onScoreUpdate: (score: number) => void,
    onWormsUpdate: (worms: number) => void
  ) {
    this.canvas = canvas;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not acquire 2D context from canvas");
    }
    this.ctx = context;

    this.onStateChange = onStateChange;
    this.onScoreUpdate = onScoreUpdate;
    this.onWormsUpdate = onWormsUpdate;

    // Initialize Game managers
    this.audio = AudioManager.getInstance();
    
    // Set standard canvas sizes as logical values (we scale visually in CSS)
    this.canvas.width = 480;
    this.canvas.height = 720;

    this.bird = new Bird(100, this.canvas.height / 2);
    this.background = new Background(this.canvas.width, this.canvas.height);
    this.obstacles = new ObstacleManager(this.canvas.width, this.canvas.height);
    this.particles = new ParticleSystem();

    this.initInput();
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  private initInput(): void {
    // Jump trigger on Tap / MouseClick / Spacebar
    const handleJumpInput = (e: Event) => {
      // Prevent scrolling on space key
      if (e instanceof KeyboardEvent && e.code !== "Space") return;
      if (e instanceof KeyboardEvent && e.code === "Space") {
        e.preventDefault();
      }

      if (this.state === "PLAYING") {
        this.bird.jump();
        this.audio.playJump();
        this.particles.spawnFeather(this.bird.x - 10, this.bird.y, this.bird.getSkin());
      } else if (this.state === "START") {
        // Start game if on start screen and they tap canvas directly
        this.startGame();
      }
    };

    // Canvas click/touch
    this.canvas.addEventListener("mousedown", handleJumpInput);
    this.canvas.addEventListener("touchstart", (e) => {
      e.preventDefault(); // Prevents double click on mobile
      handleJumpInput(e);
    });

    // Keyboard Space
    window.addEventListener("keydown", handleJumpInput);
  }

  public setBirdSkin(skin: BirdSkin): void {
    this.bird.setSkin(skin);
  }

  public getGameState(): GameState {
    return this.state;
  }

  public resize(): void {
    // Match visual canvas rendering dimensions
    const rect = this.canvas.getBoundingClientRect();
    // Maintain 480x720 internal coordinates while drawing
    this.background.resize(this.canvas.width, this.canvas.height);
    this.obstacles.reset(this.canvas.width, this.canvas.height);
  }

  public startGame(): void {
    this.state = "PLAYING";
    this.score = 0;
    this.wormsCollected = 0;
    this.currentSpeed = this.baseSpeed;
    
    this.bird.reset(this.canvas.height / 2 - 50);
    this.obstacles.reset(this.canvas.width, this.canvas.height);
    this.particles.reset();

    this.onScoreUpdate(this.score);
    this.onWormsUpdate(this.wormsCollected);
    this.onStateChange(this.state, this.score, this.wormsCollected);

    this.audio.playBgm();
    
    this.lastTime = performance.now();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.loop(this.lastTime);
  }

  public pauseGame(): void {
    if (this.state !== "PLAYING") return;
    this.state = "PAUSED";
    this.audio.stopBgm();
    this.onStateChange(this.state, this.score, this.wormsCollected);
  }

  public resumeGame(): void {
    if (this.state !== "PAUSED") return;
    this.state = "PLAYING";
    this.audio.playBgm();
    this.onStateChange(this.state, this.score, this.wormsCollected);
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public returnToMenu(): void {
    this.state = "START";
    this.audio.stopBgm();
    this.onStateChange(this.state, this.score, this.wormsCollected);
    this.drawStartFrame();
  }

  private drawStartFrame(): void {
    // Draws static screen background + bird on start menu
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.background.draw(this.ctx);
    
    // Float bird slightly
    const yFloat = this.canvas.height / 2 + Math.sin(performance.now() * 0.005) * 15;
    this.bird.y = yFloat;
    this.bird.draw(this.ctx);
  }

  private triggerGameOver(): void {
    this.state = "GAMEOVER";
    this.bird.kill();
    this.audio.stopBgm();
    this.audio.playHit();

    // Spawn crash particles
    this.particles.spawnCrashBurst(this.bird.x, this.bird.y, this.bird.getSkin());

    this.onStateChange(this.state, this.score, this.wormsCollected);
  }

  /* ==========================================================================
     Game Loop & Core Updates
     ========================================================================== */

  private loop = (timestamp: number): void => {
    if (this.state !== "PLAYING" && this.state !== "GAMEOVER") return;

    const deltaTime = Math.min(100, timestamp - this.lastTime); // Cap deltaTime to prevent massive physics jumps
    this.lastTime = timestamp;

    this.update(deltaTime);
    this.draw();

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  private update(deltaTime: number): void {
    // 1. Update particles regardless of gameover state to let crash particles fly
    this.particles.update(deltaTime);

    if (this.state === "PLAYING") {
      // Scale game speed slowly based on score to increase difficulty
      this.currentSpeed = this.baseSpeed + Math.min(3.0, this.score * 0.06);

      // 2. Update background parallax elements
      this.background.update(this.currentSpeed, deltaTime);

      // 3. Update Obstacles, collectibles and enemies
      this.obstacles.update(this.currentSpeed, this.score, deltaTime);

      // 4. Update Bird physics
      this.bird.update(deltaTime, this.canvas.height);

      // 5. Perform collision checking
      this.checkCollisions();
    } else if (this.state === "GAMEOVER") {
      // In Game Over, only update bird fall until it hits ground
      this.bird.update(deltaTime, this.canvas.height);
    }
  }

  private draw(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Draw static sky, parallax background elements
    this.background.draw(this.ctx);

    // 2. Draw Pipes, Pests, and Worms
    this.obstacles.draw(this.ctx);

    // 3. Draw feather / collect sparkles / crash burst particles
    this.particles.draw(this.ctx);

    // 4. Draw main player Bird
    this.bird.draw(this.ctx);

    // Debug Mode Bounding Box Renders
    if (this.isDebugMode) {
      this.bird.drawDebug(this.ctx);
      this.obstacles.drawDebug(this.ctx);
      
      // Draw collision ceiling/floor bounds
      this.ctx.strokeStyle = "magenta";
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(0, 0, this.canvas.width, 1);
      this.ctx.strokeRect(0, this.canvas.height - Background.FLOOR_HEIGHT, this.canvas.width, 1);
    }
  }

  /* ==========================================================================
     Physics & Collision Handlers
     ========================================================================== */

  private checkCollisions(): void {
    const floorY = this.canvas.height - Background.FLOOR_HEIGHT;

    // 1. Ceiling & Floor Accurate Bound Check
    // If bird collision circle goes beyond top or bottom, trigger Game Over
    if (this.bird.y - this.bird.collisionRadius <= 0) {
      this.triggerGameOver();
      return;
    }
    if (this.bird.y + this.bird.collisionRadius >= floorY) {
      this.triggerGameOver();
      return;
    }

    // 2. Pipes Collision Check (Circle vs AABB)
    const pipes = this.obstacles.getPipes();
    for (let i = 0; i < pipes.length; i++) {
      const p = pipes[i];

      // Top Pipe Rectangle
      const hitTop = this.checkCircleRectCollision(
        this.bird.x, this.bird.y, this.bird.collisionRadius,
        p.x, 0, p.width, p.topHeight
      );

      // Bottom Pipe Rectangle
      const hitBottom = this.checkCircleRectCollision(
        this.bird.x, this.bird.y, this.bird.collisionRadius,
        p.x, floorY - p.bottomHeight, p.width, p.bottomHeight
      );

      if (hitTop || hitBottom) {
        this.triggerGameOver();
        return;
      }

      // Check if bird passed the pipe pair to increment score
      if (!p.passed && this.bird.x > p.x + p.width) {
        p.passed = true;
        this.score += 1;
        this.onScoreUpdate(this.score);
        this.audio.playPoint();
      }
    }

    // 3. Floating Pests Collision Check (Circle vs Circle)
    const pests = this.obstacles.getPests();
    for (let i = 0; i < pests.length; i++) {
      const pest = pests[i];
      const dist = Math.hypot(this.bird.x - pest.x, this.bird.y - pest.y);
      if (dist < this.bird.collisionRadius + pest.radius) {
        this.triggerGameOver();
        return;
      }
    }

    // 4. Worm Collectibles Check (Circle vs Circle)
    const worms = this.obstacles.getWorms();
    for (let i = 0; i < worms.length; i++) {
      const worm = worms[i];
      if (worm.collected) continue;

      const dist = Math.hypot(this.bird.x - worm.x, this.bird.y - worm.y);
      if (dist < this.bird.collisionRadius + worm.radius) {
        // Collect worm!
        worm.collected = true;
        this.wormsCollected += 1;
        this.score += worm.points; // Add bonus points for finding worms!
        
        this.onWormsUpdate(this.wormsCollected);
        this.onScoreUpdate(this.score);
        this.audio.playWormCollect();
        
        // Spawn shiny sparkles
        this.particles.spawnWormSparkles(worm.x, worm.y);
      }
    }
  }

  // AABB vs Circle math helper
  private checkCircleRectCollision(
    cx: number, cy: number, radius: number,
    rx: number, ry: number, rw: number, rh: number
  ): boolean {
    // Find closest point on rectangle to circle center
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));

    // Calculate distance between closest point and circle center
    const distanceX = cx - closestX;
    const distanceY = cy - closestY;

    // If distance is less than circle radius, collision exists
    const distSq = distanceX * distanceX + distanceY * distanceY;
    return distSq < radius * radius;
  }

  // Toggle debug boundary renderer
  public toggleDebug(): boolean {
    this.isDebugMode = !this.isDebugMode;
    return this.isDebugMode;
  }
}
