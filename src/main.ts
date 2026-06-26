import "./style.css";
import { GameEngine, GameState } from "./game/Engine";
import { BirdSkin } from "./game/Bird";
import { 
  initializeFirebase, 
  submitScore, 
  getLeaderboard, 
  isFirebaseConnected, 
  saveFirebaseConfig, 
  clearFirebaseConfig, 
  getFirebaseConfig 
} from "./firebase";
import { AudioManager } from "./game/AudioManager";

// Global Game Variables
let engine: GameEngine;
const audio = AudioManager.getInstance();

// DOM Elements
const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const hud = document.getElementById("hud") as HTMLDivElement;
const hudScore = document.getElementById("hud-score") as HTMLDivElement;
const hudWorms = document.getElementById("hud-worms") as HTMLSpanElement;
const pauseBtn = document.getElementById("pause-btn") as HTMLButtonElement;

// Screens
const startScreen = document.getElementById("start-screen") as HTMLDivElement;
const pauseScreen = document.getElementById("pause-screen") as HTMLDivElement;
const gameOverScreen = document.getElementById("game-over-screen") as HTMLDivElement;
const configScreen = document.getElementById("config-screen") as HTMLDivElement;

// Buttons & Actions
const playBtn = document.getElementById("play-btn") as HTMLButtonElement;
const leaderboardBtn = document.getElementById("leaderboard-btn") as HTMLButtonElement;
const settingsBtn = document.getElementById("settings-btn") as HTMLButtonElement;
const resumeBtn = document.getElementById("resume-btn") as HTMLButtonElement;
const restartFromPauseBtn = document.getElementById("restart-from-pause-btn") as HTMLButtonElement;
const menuFromPauseBtn = document.getElementById("menu-from-pause-btn") as HTMLButtonElement;
const restartBtn = document.getElementById("restart-btn") as HTMLButtonElement;
const menuBtn = document.getElementById("menu-btn") as HTMLButtonElement;

// Score Submission
const finalScoreVal = document.getElementById("final-score") as HTMLSpanElement;
const finalWormsVal = document.getElementById("final-worms") as HTMLSpanElement;
const newHighScoreBadge = document.getElementById("new-high-score-badge") as HTMLDivElement;
const leaderboardSubmission = document.getElementById("leaderboard-submission") as HTMLDivElement;
const scoreForm = document.getElementById("score-form") as HTMLFormElement;
const playerNameInput = document.getElementById("player-name") as HTMLInputElement;
const submitScoreBtn = document.getElementById("submit-score-btn") as HTMLButtonElement;

// Leaderboard Display
const leaderboardList = document.getElementById("leaderboard-list") as HTMLOListElement;
const leaderboardTypeLabel = document.getElementById("leaderboard-type-label") as HTMLSpanElement;

// Config Modal Form
const configForm = document.getElementById("firebase-config-form") as HTMLFormElement;
const configApiKey = document.getElementById("config-apiKey") as HTMLInputElement;
const configAuthDomain = document.getElementById("config-authDomain") as HTMLInputElement;
const configProjectId = document.getElementById("config-projectId") as HTMLInputElement;
const configStorageBucket = document.getElementById("config-storageBucket") as HTMLInputElement;
const configMessagingSenderId = document.getElementById("config-messagingSenderId") as HTMLInputElement;
const configAppId = document.getElementById("config-appId") as HTMLInputElement;
const configCloseBtn = document.getElementById("config-close-btn") as HTMLButtonElement;
const configClearBtn = document.getElementById("config-clear-btn") as HTMLButtonElement;

// Active Skin state
let selectedSkin: BirdSkin = "yellow";

/* ==========================================================================
   Initialization
   ========================================================================== */

async function init() {
  // 1. Initial connection attempt to Firebase
  const firebaseSuccess = await initializeFirebase();
  console.log("Firebase connection status:", firebaseSuccess ? "CONNECTED" : "OFFLINE/LOCAL STORAGE ONLY");

  // 2. Load last skin selection
  const storedSkin = localStorage.getItem("find_my_worm_bird_skin") as BirdSkin;
  if (storedSkin === "yellow" || storedSkin === "blue" || storedSkin === "red") {
    selectedSkin = storedSkin;
    updateSkinSelectorUI(selectedSkin);
  }

  // 3. Instantiate GameEngine
  engine = new GameEngine(
    canvas,
    onStateChange,
    onScoreUpdate,
    onWormsUpdate
  );

  engine.setBirdSkin(selectedSkin);
  engine.returnToMenu(); // Sets up static screen state

  // 4. Bind UI listeners
  setupUIEventListeners();
  loadSavedName();
}

/* ==========================================================================
   UI Controls & Submissions
   ========================================================================== */

function setupUIEventListeners() {
  // Play button on menu
  playBtn.addEventListener("click", () => {
    engine.startGame();
  });

  // Pause button in HUD
  pauseBtn.addEventListener("click", () => {
    engine.pauseGame();
  });

  // Pause menu actions
  resumeBtn.addEventListener("click", () => engine.resumeGame());
  restartFromPauseBtn.addEventListener("click", () => engine.startGame());
  menuFromPauseBtn.addEventListener("click", () => engine.returnToMenu());

  // Game over screen actions
  restartBtn.addEventListener("click", () => {
    engine.startGame();
  });
  menuBtn.addEventListener("click", () => {
    engine.returnToMenu();
  });

  // Settings / Firebase Config open button
  settingsBtn.addEventListener("click", () => {
    openConfigModal();
  });

  configCloseBtn.addEventListener("click", () => {
    configScreen.classList.add("hidden");
  });

  configClearBtn.addEventListener("click", () => {
    if (confirm("Clear Firebase configuration? The game will fall back to local storage leaderboards.")) {
      clearFirebaseConfig();
      configScreen.classList.add("hidden");
      alert("Config cleared. Reloading page to apply...");
      window.location.reload();
    }
  });

  // Firebase config submit
  configForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const config = {
      apiKey: configApiKey.value.trim(),
      authDomain: configAuthDomain.value.trim(),
      projectId: configProjectId.value.trim(),
      storageBucket: configStorageBucket.value.trim(),
      messagingSenderId: configMessagingSenderId.value.trim(),
      appId: configAppId.value.trim(),
    };

    if (config.apiKey && config.projectId) {
      saveFirebaseConfig(config);
      configScreen.classList.add("hidden");
      alert("Configuration saved! Reconnecting database...");
      window.location.reload();
    } else {
      alert("Please enter at least an API Key and Project ID.");
    }
  });

  // Main menu leaderboard trigger (displays leaderboard modal if we had one, or shortcut to gameover view)
  leaderboardBtn.addEventListener("click", async () => {
    // Show game over overlay structure but format it as just a leaderboard view
    onStateChange("GAMEOVER", 0, 0);
    // Hide game-specific stats and submit options
    finalScoreVal.parentElement!.parentElement!.classList.add("hidden");
    leaderboardSubmission.classList.add("hidden");
    newHighScoreBadge.classList.add("hidden");
  });

  // Skin selectors
  const skinOptions = document.querySelectorAll(".skin-option");
  skinOptions.forEach(opt => {
    opt.addEventListener("click", () => {
      skinOptions.forEach(o => o.classList.remove("active"));
      opt.classList.add("active");
      
      const skin = opt.getAttribute("data-skin") as BirdSkin;
      selectedSkin = skin;
      localStorage.setItem("find_my_worm_bird_skin", skin);
      engine.setBirdSkin(skin);
      
      // Play a jump synth preview sound
      audio.playJump();
    });
  });

  // Score Submit Form
  scoreForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = playerNameInput.value.trim().substring(0, 10);
    if (!name) return;

    // Save name locally for convenience
    localStorage.setItem("find_my_worm_player_name", name);
    
    submitScoreBtn.disabled = true;
    submitScoreBtn.textContent = "Saving...";

    const score = Number(finalScoreVal.textContent) || 0;
    const worms = Number(finalWormsVal.textContent) || 0;

    await submitScore(name, score, worms);
    
    // Hide submission pane and reload leaderboard
    leaderboardSubmission.classList.add("hidden");
    await loadLeaderboard();
  });
}

function updateSkinSelectorUI(skin: BirdSkin) {
  const skinOptions = document.querySelectorAll(".skin-option");
  skinOptions.forEach(opt => {
    if (opt.getAttribute("data-skin") === skin) {
      opt.classList.add("active");
    } else {
      opt.classList.remove("active");
    }
  });
}

function loadSavedName() {
  const savedName = localStorage.getItem("find_my_worm_player_name");
  if (savedName) {
    playerNameInput.value = savedName;
  }
}

function openConfigModal() {
  const currentConfig = getFirebaseConfig();
  if (currentConfig) {
    configApiKey.value = currentConfig.apiKey || "";
    configAuthDomain.value = currentConfig.authDomain || "";
    configProjectId.value = currentConfig.projectId || "";
    configStorageBucket.value = currentConfig.storageBucket || "";
    configMessagingSenderId.value = currentConfig.messagingSenderId || "";
    configAppId.value = currentConfig.appId || "";
  }
  configScreen.classList.remove("hidden");
}

/* ==========================================================================
   State Change Bindings (Engine -> UI)
   ========================================================================== */

async function onStateChange(state: GameState, score: number, worms: number) {
  // Hide all screens initially
  startScreen.classList.add("hidden");
  pauseScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
  configScreen.classList.add("hidden");

  switch (state) {
    case "START":
      startScreen.classList.remove("hidden");
      hud.classList.add("hidden");
      break;

    case "PLAYING":
      hud.classList.remove("hidden");
      break;

    case "PAUSED":
      hud.classList.remove("hidden");
      pauseScreen.classList.remove("hidden");
      break;

    case "GAMEOVER":
      hud.classList.add("hidden");
      gameOverScreen.classList.remove("hidden");
      
      // Update score fields
      finalScoreVal.textContent = String(score);
      finalWormsVal.textContent = String(worms);
      finalScoreVal.parentElement!.parentElement!.classList.remove("hidden");

      // Enable name submission for positive scores
      if (score > 0) {
        leaderboardSubmission.classList.remove("hidden");
        submitScoreBtn.disabled = false;
        submitScoreBtn.textContent = "Submit";
      } else {
        leaderboardSubmission.classList.add("hidden");
      }

      // Check high score record
      const highestScore = Number(localStorage.getItem("find_my_worm_personal_best")) || 0;
      if (score > highestScore && score > 0) {
        localStorage.setItem("find_my_worm_personal_best", String(score));
        newHighScoreBadge.classList.remove("hidden");
      } else {
        newHighScoreBadge.classList.add("hidden");
      }

      // Load leaderboards
      await loadLeaderboard();
      break;
  }
}

function onScoreUpdate(score: number) {
  hudScore.textContent = String(score);
}

function onWormsUpdate(worms: number) {
  hudWorms.textContent = String(worms);
}

/* ==========================================================================
   Leaderboard Loaders
   ========================================================================== */

async function loadLeaderboard() {
  leaderboardList.innerHTML = '<li class="loading-item">Fetching ranking...</li>';
  
  if (isFirebaseConnected()) {
    leaderboardTypeLabel.textContent = "Global (DB)";
    leaderboardTypeLabel.classList.add("online");
  } else {
    leaderboardTypeLabel.textContent = "Offline (Local)";
    leaderboardTypeLabel.classList.remove("online");
  }

  try {
    const { isGlobal, scores } = await getLeaderboard();
    
    // Update badge type dynamically if it changed during load
    if (isGlobal) {
      leaderboardTypeLabel.textContent = "Global (DB)";
      leaderboardTypeLabel.classList.add("online");
    } else {
      leaderboardTypeLabel.textContent = "Offline (Local)";
      leaderboardTypeLabel.classList.remove("online");
    }

    if (scores.length === 0) {
      leaderboardList.innerHTML = '<li class="loading-item">No records yet! Be the first!</li>';
      return;
    }

    leaderboardList.innerHTML = "";
    scores.forEach((entry) => {
      const li = document.createElement("li");
      
      const infoDiv = document.createElement("div");
      infoDiv.className = "leaderboard-player-info";
      
      const rankSpan = document.createElement("span");
      rankSpan.className = "player-rank";
      rankSpan.textContent = `#${entry.rank}`;
      
      const nameSpan = document.createElement("span");
      nameSpan.className = "player-name";
      nameSpan.textContent = entry.name;
      
      infoDiv.appendChild(rankSpan);
      infoDiv.appendChild(nameSpan);

      const detailsDiv = document.createElement("div");
      detailsDiv.className = "player-details";

      const scoreSpan = document.createElement("span");
      scoreSpan.className = "player-score";
      scoreSpan.textContent = String(entry.score);

      const wormsSpan = document.createElement("span");
      wormsSpan.className = "player-worms-badge";
      wormsSpan.innerHTML = `🐛 ${entry.worms}`;

      detailsDiv.appendChild(scoreSpan);
      detailsDiv.appendChild(wormsSpan);

      li.appendChild(infoDiv);
      li.appendChild(detailsDiv);

      leaderboardList.appendChild(li);
    });
  } catch (err) {
    console.error("Leaderboard render error", err);
    leaderboardList.innerHTML = '<li class="loading-item">Failed to load leaderboard</li>';
  }
}

// Start Application on Load
window.addEventListener("DOMContentLoaded", () => {
  init();
});
