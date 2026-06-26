import { Background } from "./Background";

export type BirdSkin = "yellow" | "blue" | "red";

export class Bird {
  public x: number;
  public y: number;
  public radius = 18; // Visual radius
  public collisionRadius = 14; // Lenient collision radius
  
  private velocity = 0;
  private gravity = 0.35;
  private jumpForce = -7.0;
  private maxFallSpeed = 10.0;
  private rotation = 0;
  
  private skin: BirdSkin = "yellow";
  private wingFlapTimer = 0;
  private isDead = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  public setSkin(skin: BirdSkin): void {
    this.skin = skin;
  }

  public getSkin(): BirdSkin {
    return this.skin;
  }

  public reset(y: number): void {
    this.y = y;
    this.velocity = 0;
    this.rotation = 0;
    this.isDead = false;
  }

  public jump(): void {
    if (this.isDead) return;
    this.velocity = this.jumpForce;
  }

  public kill(): void {
    this.isDead = true;
  }

  public update(deltaTime: number, canvasHeight: number): void {
    const dt = deltaTime / 16.666; // Normalize to ~60fps
    
    // Apply gravity
    this.velocity += this.gravity * dt;
    if (this.velocity > this.maxFallSpeed) {
      this.velocity = this.maxFallSpeed;
    }
    
    this.y += this.velocity * dt;

    // Wing flap animation speed matches velocity (flaps faster when going up/jumping)
    if (!this.isDead) {
      this.wingFlapTimer += (this.velocity < 0 ? 0.25 : 0.1) * dt;
    }

    // Set rotation based on vertical velocity
    if (this.velocity < 0) {
      // Jumping up: rotate upward (up to -20 degrees)
      this.rotation = Math.max(-0.4, this.velocity * 0.08);
    } else {
      // Falling down: rotate downward (up to 70 degrees / ~1.2 radians)
      this.rotation = Math.min(1.2, this.velocity * 0.12);
    }

    // Floor and Ceiling bounds enforcement
    const floorY = canvasHeight - Background.FLOOR_HEIGHT;
    
    if (this.y - this.radius < 0) {
      // Collide with ceiling
      this.y = this.radius;
      this.velocity = 0;
    }
    
    if (this.y + this.radius > floorY) {
      // Collide with floor
      this.y = floorY - this.radius;
      this.velocity = 0;
    }
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // Color schemes for skins
    let bodyColor = "#facc15"; // Yellow
    let bodyShadow = "#ca8a04";
    let wingColor = "#eab308";
    let bellyColor = "#fef08a";

    if (this.skin === "blue") {
      bodyColor = "#3b82f6"; // Blue
      bodyShadow = "#1d4ed8";
      wingColor = "#2563eb";
      bellyColor = "#93c5fd";
    } else if (this.skin === "red") {
      bodyColor = "#ef4444"; // Red
      bodyShadow = "#b91c1c";
      wingColor = "#dc2626";
      bellyColor = "#fca5a5";
    }

    // 1. Draw Body Shadow (bottom shift)
    ctx.fillStyle = bodyShadow;
    ctx.beginPath();
    ctx.arc(0, 2, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // 2. Draw Body
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // 3. Draw Belly / Breast highlight
    ctx.fillStyle = bellyColor;
    ctx.beginPath();
    ctx.arc(this.radius * 0.3, this.radius * 0.3, this.radius * 0.7, 0.2, Math.PI * 0.9);
    ctx.fill();

    // 4. Draw Eye
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(this.radius * 0.4, -this.radius * 0.3, this.radius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(this.radius * 0.5, -this.radius * 0.3, this.radius * 0.18, 0, Math.PI * 2);
    ctx.fill();

    // Pupil Sparkle
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(this.radius * 0.55, -this.radius * 0.35, this.radius * 0.06, 0, Math.PI * 2);
    ctx.fill();

    // 5. Draw Beak
    ctx.fillStyle = "#f97316"; // Orange
    ctx.beginPath();
    ctx.moveTo(this.radius * 0.8, -this.radius * 0.1);
    ctx.lineTo(this.radius * 1.3, 0);
    ctx.lineTo(this.radius * 0.8, this.radius * 0.25);
    ctx.closePath();
    ctx.fill();

    // Beak line
    ctx.strokeStyle = "#ea580c";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.radius * 0.8, 0.08);
    ctx.lineTo(this.radius * 1.15, 0.08);
    ctx.stroke();

    // 6. Draw Wing (Flapping motion based on timer)
    ctx.save();
    ctx.translate(-this.radius * 0.3, this.radius * 0.1);
    
    // Wing rotation oscillates
    const flap = Math.sin(this.wingFlapTimer * Math.PI * 2);
    ctx.rotate(flap * 0.5); // Up to 30 degrees tilt on wing

    // Wing shadow
    ctx.fillStyle = bodyShadow;
    ctx.beginPath();
    ctx.ellipse(0, 1, this.radius * 0.65, this.radius * 0.4, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Wing body
    ctx.fillStyle = wingColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.radius * 0.65, this.radius * 0.4, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Wing detail stripes
    ctx.strokeStyle = bellyColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-this.radius * 0.3, 0);
    ctx.lineTo(this.radius * 0.2, 0);
    ctx.moveTo(-this.radius * 0.1, this.radius * 0.15);
    ctx.lineTo(this.radius * 0.3, -0.05);
    ctx.stroke();

    ctx.restore();

    ctx.restore();
  }

  // Debug helper to render collision boundaries
  public drawDebug(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.collisionRadius, 0, Math.PI * 2);
    ctx.stroke();
  }
}
