interface Cloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
}

interface SilhouetteBuilding {
  x: number;
  width: number;
  height: number;
  color: string;
}

export class Background {
  private clouds: Cloud[] = [];
  private distantBuildings: SilhouetteBuilding[] = [];
  private nearBuildings: SilhouetteBuilding[] = [];
  private groundX = 0;
  private canvasWidth = 0;
  private canvasHeight = 0;
  
  public static readonly FLOOR_HEIGHT = 100; // Floor offset from bottom

  constructor(width: number, height: number) {
    this.resize(width, height);
    this.initClouds();
    this.initSilhouettes();
  }

  public resize(width: number, height: number): void {
    const oldWidth = this.canvasWidth;
    this.canvasWidth = width;
    this.canvasHeight = height;

    if (oldWidth > 0 && oldWidth !== width) {
      // Rescale cloud positions if resizing
      this.clouds.forEach(cloud => {
        cloud.x = (cloud.x / oldWidth) * width;
      });
      // Reinitialize silhouettes to fit new width
      this.initSilhouettes();
    }
  }

  private initClouds(): void {
    this.clouds = [];
    const count = 5;
    for (let i = 0; i < count; i++) {
      this.clouds.push({
        x: Math.random() * this.canvasWidth,
        y: 50 + Math.random() * 150,
        scale: 0.6 + Math.random() * 0.8,
        speed: 0.05 + Math.random() * 0.1,
      });
    }
  }

  private initSilhouettes(): void {
    this.distantBuildings = [];
    this.nearBuildings = [];

    // Initialize distant buildings (slower, darker purple-blue)
    let currentX = 0;
    while (currentX < this.canvasWidth + 200) {
      const w = 60 + Math.random() * 80;
      const h = 120 + Math.random() * 120;
      this.distantBuildings.push({
        x: currentX,
        width: w,
        height: h,
        color: "#1e1b4b" // Deep dark indigo
      });
      currentX += w - 10; // Overlay slightly
    }

    // Initialize near buildings (medium speed, slate blue)
    currentX = 0;
    while (currentX < this.canvasWidth + 200) {
      const w = 40 + Math.random() * 60;
      const h = 60 + Math.random() * 80;
      this.nearBuildings.push({
        x: currentX,
        width: w,
        height: h,
        color: "#1e293b" // Slate 800
      });
      currentX += w - 5;
    }
  }

  public update(speed: number, deltaTime: number): void {
    const dt = deltaTime / 16.666; // Normalize to ~60fps

    // Scroll clouds (independent wind speed)
    this.clouds.forEach(cloud => {
      cloud.x -= cloud.speed * dt;
      if (cloud.x + 100 * cloud.scale < 0) {
        cloud.x = this.canvasWidth + 50;
        cloud.y = 50 + Math.random() * 150;
      }
    });

    // Scroll distant buildings (parallax factor: 0.1)
    const distFactor = speed * 0.1 * dt;
    this.distantBuildings.forEach(b => {
      b.x -= distFactor;
    });
    // Check wrap-around
    if (this.distantBuildings.length > 0 && this.distantBuildings[0].x + this.distantBuildings[0].width < 0) {
      const first = this.distantBuildings.shift()!;
      const last = this.distantBuildings[this.distantBuildings.length - 1];
      first.x = last.x + last.width - 10;
      this.distantBuildings.push(first);
    }

    // Scroll near buildings (parallax factor: 0.35)
    const nearFactor = speed * 0.35 * dt;
    this.nearBuildings.forEach(b => {
      b.x -= nearFactor;
    });
    // Check wrap-around
    if (this.nearBuildings.length > 0 && this.nearBuildings[0].x + this.nearBuildings[0].width < 0) {
      const first = this.nearBuildings.shift()!;
      const last = this.nearBuildings[this.nearBuildings.length - 1];
      first.x = last.x + last.width - 5;
      this.nearBuildings.push(first);
    }

    // Scroll ground (factor: 1.0, matches main scrolling)
    this.groundX = (this.groundX - speed * dt) % 30;
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    const floorY = this.canvasHeight - Background.FLOOR_HEIGHT;

    // 1. Draw Sky Linear Gradient (Sunset color palette)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, floorY);
    skyGrad.addColorStop(0, "#0f172a"); // Deep space
    skyGrad.addColorStop(0.4, "#1e1b4b"); // Dark purple
    skyGrad.addColorStop(0.75, "#311042"); // Violet hue
    skyGrad.addColorStop(1, "#581c87"); // Radiant magenta/purple
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.canvasWidth, floorY);

    // 2. Draw Distant Buildings Silhouettes (Parallax layer 1)
    ctx.fillStyle = "rgba(30, 27, 75, 0.4)"; // Faded deep indigo
    this.distantBuildings.forEach(b => {
      ctx.fillRect(b.x, floorY - b.height, b.width, b.height);
      // Optional: Draw simple building details (windows)
      ctx.fillStyle = "rgba(253, 224, 71, 0.15)"; // Yellow glow
      const cols = Math.floor(b.width / 15);
      const rows = Math.floor(b.height / 25);
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if ((c + r) % 3 === 0) {
            ctx.fillRect(b.x + 10 + c * 15, floorY - b.height + 15 + r * 25, 4, 8);
          }
        }
      }
      ctx.fillStyle = "rgba(30, 27, 75, 0.4)";
    });

    // 3. Draw Near Buildings (Parallax layer 2)
    ctx.fillStyle = "#1e293b"; // Dark slate
    this.nearBuildings.forEach(b => {
      ctx.fillRect(b.x, floorY - b.height, b.width, b.height);
      
      // Draw building antennae/spires
      if (b.width > 50) {
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.x + b.width / 2, floorY - b.height);
        ctx.lineTo(b.x + b.width / 2, floorY - b.height - 15);
        ctx.stroke();
      }

      // Draw lit windows
      ctx.fillStyle = "rgba(254, 240, 138, 0.25)"; // Bright yellow
      const cols = Math.floor(b.width / 12);
      const rows = Math.floor(b.height / 18);
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if ((c * 2 + r) % 5 === 0) {
            ctx.fillRect(b.x + 8 + c * 12, floorY - b.height + 10 + r * 18, 3, 5);
          }
        }
      }
      ctx.fillStyle = "#1e293b";
    });

    // 4. Draw Clouds
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    this.clouds.forEach(cloud => {
      const cx = cloud.x;
      const cy = cloud.y;
      const cs = cloud.scale;

      ctx.beginPath();
      ctx.arc(cx, cy, 25 * cs, 0, Math.PI * 2);
      ctx.arc(cx + 20 * cs, cy - 10 * cs, 28 * cs, 0, Math.PI * 2);
      ctx.arc(cx + 40 * cs, cy, 22 * cs, 0, Math.PI * 2);
      ctx.arc(cx + 20 * cs, cy + 10 * cs, 20 * cs, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    });

    // 5. Draw Floor Ground (Solid scrolling zone)
    // Soil base
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, floorY, this.canvasWidth, Background.FLOOR_HEIGHT);

    // Decorative ground stripes / grass top
    const grassGrad = ctx.createLinearGradient(0, floorY, 0, floorY + 16);
    grassGrad.addColorStop(0, "#4f46e5"); // Indigo light edge
    grassGrad.addColorStop(0.3, "#312e81"); // Deep indigo grass
    grassGrad.addColorStop(1, "#0f172a"); // Fade into background
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, floorY, this.canvasWidth, 16);

    // Scrolling soil patterns for movement feel
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    for (let x = this.groundX; x < this.canvasWidth + 30; x += 30) {
      // Angled ground stripes
      ctx.beginPath();
      ctx.moveTo(x, floorY + 16);
      ctx.lineTo(x + 10, floorY + 16);
      ctx.lineTo(x - 5, floorY + Background.FLOOR_HEIGHT);
      ctx.lineTo(x - 15, floorY + Background.FLOOR_HEIGHT);
      ctx.closePath();
      ctx.fill();
    }

    // Top border highlight
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(this.canvasWidth, floorY);
    ctx.stroke();
  }
}
