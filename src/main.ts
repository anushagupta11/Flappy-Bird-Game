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
  getFirebaseConfig,
  signInWithGoogle,
  logOut,
  onAuthChanged,
  checkUsernameExists,
  subscribeLeaderboard,
  getUserHighScore
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
const leaderboardScreen = document.getElementById("leaderboard-screen") as HTMLDivElement;

// Buttons & Actions
const playBtn = document.getElementById("play-btn") as HTMLButtonElement;
const leaderboardBtn = document.getElementById("leaderboard-btn") as HTMLButtonElement;
const settingsBtn = document.getElementById("settings-btn") as HTMLButtonElement;
const menuMuteBtn = document.getElementById("menu-mute-btn") as HTMLButtonElement;
const hudMuteBtn = document.getElementById("hud-mute-btn") as HTMLButtonElement;
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
const globalLeaderboardList = document.getElementById("global-leaderboard-list") as HTMLOListElement;
const globalLeaderboardTypeLabel = document.getElementById("global-leaderboard-type-label") as HTMLSpanElement;
const leaderboardBackBtn = document.getElementById("leaderboard-back-btn") as HTMLButtonElement;

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

// Auth DOM Elements
const authScreen = document.getElementById("auth-screen") as HTMLDivElement;
const profileContainer = document.getElementById("profile-container") as HTMLDivElement;
const profileUnauth = document.getElementById("profile-unauth") as HTMLDivElement;
const profileAuth = document.getElementById("profile-auth") as HTMLDivElement;
const profileUsername = document.getElementById("profile-username") as HTMLSpanElement;
const menuSignInBtn = document.getElementById("menu-signin-btn") as HTMLButtonElement;
const menuSignOutBtn = document.getElementById("menu-signout-btn") as HTMLButtonElement;
const googleSignInBtn = document.getElementById("google-signin-btn") as HTMLButtonElement;
const authCloseBtn = document.getElementById("auth-close-btn") as HTMLButtonElement;
const leaderboardAuthPrompt = document.getElementById("leaderboard-auth-prompt") as HTMLDivElement;
const gameoverSignInBtn = document.getElementById("gameover-signin-btn") as HTMLButtonElement;
const usernameErrorMsg = document.getElementById("username-error-msg") as HTMLDivElement;

// Auth State
let currentUser: any = null;
let cachedUsername: string | null = null;
let cachedHighScore = 0;
let pendingRunScore = 0;
let pendingRunWorms = 0;
let leaderboardUnsubscribe: (() => void) | null = null;

// Active Skin state
let selectedSkin: BirdSkin = "yellow";

/* ==========================================================================
   Initialization
   ========================================================================== */

async function init() {
  // 1. Initial connection attempt to Firebase
  const firebaseSuccess = await initializeFirebase();
  console.log("Firebase connection status:", firebaseSuccess ? "CONNECTED" : "OFFLINE/LOCAL STORAGE ONLY");

  // Hook up auth change listener
  onAuthChanged(async (user) => {
    currentUser = user;
    if (user) {
      // Fetch user profile info from Firestore
      const userProfile = await getUserHighScore(user.uid);
      if (userProfile) {
        cachedUsername = userProfile.name;
        cachedHighScore = userProfile.score;
        localStorage.setItem("find_my_worm_player_name", userProfile.name);
      } else {
        cachedUsername = null;
        cachedHighScore = 0;
      }

      // If we have a pending run score to submit from a previous run
      if (pendingRunScore > 0) {
        if (cachedUsername) {
          const tempScore = pendingRunScore;
          const tempWorms = pendingRunWorms;
          pendingRunScore = 0;
          pendingRunWorms = 0;
          await submitScore(cachedUsername, tempScore, tempWorms);
        } else {
          // No username yet: updateAuthUI() will show the submission panel
        }
      }
    } else {
      cachedUsername = null;
      cachedHighScore = 0;
      pendingRunScore = 0;
      pendingRunWorms = 0;
    }
    updateAuthUI();
    initLeaderboardSubscription();
  });

  // 2. Load last skin selection
  const storedSkin = localStorage.getItem("find_my_worm_bird_skin") as BirdSkin;
  if (storedSkin === "yellow" || storedSkin === "blue" || storedSkin === "red") {
    selectedSkin = storedSkin;
    updateSkinSelectorUI(selectedSkin);
  }

  // 2.5. Sync mute UI state
  updateMuteUI();

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
  // Auth Screen Triggers
  menuSignInBtn.addEventListener("click", () => {
    authScreen.classList.remove("hidden");
  });

  menuSignOutBtn.addEventListener("click", async () => {
    if (confirm("Are you sure you want to sign out?")) {
      await logOut();
      alert("Signed out successfully!");
    }
  });

  gameoverSignInBtn.addEventListener("click", () => {
    authScreen.classList.remove("hidden");
  });

  authCloseBtn.addEventListener("click", () => {
    authScreen.classList.add("hidden");
  });

  // Auth Operations
  googleSignInBtn.addEventListener("click", async () => {
    try {
      googleSignInBtn.disabled = true;
      const originalText = googleSignInBtn.innerHTML;
      googleSignInBtn.textContent = "Connecting...";
      await signInWithGoogle();
      googleSignInBtn.disabled = false;
      googleSignInBtn.innerHTML = originalText;
      authScreen.classList.add("hidden");
      alert("Signed in with Google successfully!");
    } catch (err) {
      googleSignInBtn.disabled = false;
      googleSignInBtn.innerHTML = `
        <svg class="btn-icon" viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" style="margin-right: 10px; fill: white;">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#ffffff"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#ffffff"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#ffffff"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#ffffff"/>
        </svg>
        Sign In with Google
      `;
      alert("Failed to sign in with Google.");
    }
  });

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

  // Mute button actions
  menuMuteBtn.addEventListener("click", () => {
    audio.toggleMute();
    updateMuteUI();
  });

  hudMuteBtn.addEventListener("click", () => {
    audio.toggleMute();
    updateMuteUI();
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

  // Main menu leaderboard trigger
  leaderboardBtn.addEventListener("click", () => {
    showLeaderboardScreen();
  });

  // Leaderboard back to menu trigger
  leaderboardBackBtn.addEventListener("click", () => {
    onStateChange("START", 0, 0);
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

    // Reset error message state
    usernameErrorMsg.classList.add("hidden");
    submitScoreBtn.disabled = true;
    submitScoreBtn.textContent = "Checking...";

    // Validate unique username in Firestore if connected
    if (currentUser) {
      const isTaken = await checkUsernameExists(name, currentUser.uid);
      if (isTaken) {
        usernameErrorMsg.classList.remove("hidden");
        submitScoreBtn.disabled = false;
        submitScoreBtn.textContent = "Submit";
        return;
      }
    }

    // Save name locally for convenience
    localStorage.setItem("find_my_worm_player_name", name);
    submitScoreBtn.textContent = "Saving...";

    const score = pendingRunScore > 0 ? pendingRunScore : (Number(finalScoreVal.textContent) || 0);
    const worms = pendingRunScore > 0 ? pendingRunWorms : (Number(finalWormsVal.textContent) || 0);

    // Cache the chosen username
    cachedUsername = name;

    await submitScore(name, score, worms);
    
    // Reset pending values
    pendingRunScore = 0;
    pendingRunWorms = 0;
    
    // Hide submission pane
    leaderboardSubmission.classList.add("hidden");
    
    // Remove auto-sync message if any exists
    const existing = document.getElementById("score-sync-status");
    if (existing) existing.remove();
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

function updateMuteUI() {
  const isMuted = audio.getMuteState();
  const volumeOnIcons = document.querySelectorAll(".volume-on");
  const volumeOffIcons = document.querySelectorAll(".volume-off");

  if (isMuted) {
    volumeOnIcons.forEach(icon => icon.classList.add("hidden"));
    volumeOffIcons.forEach(icon => icon.classList.remove("hidden"));
  } else {
    volumeOnIcons.forEach(icon => icon.classList.remove("hidden"));
    volumeOffIcons.forEach(icon => icon.classList.add("hidden"));
  }
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
  leaderboardScreen.classList.add("hidden");

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

      // Enable name/auth submission for positive scores
      if (score > 0) {
        if (currentUser) {
          if (cachedUsername) {
            // Already has username: submit score in the background automatically!
            leaderboardSubmission.classList.add("hidden");
            leaderboardAuthPrompt.classList.add("hidden");
            
            // We do background submit
            (async () => {
              await submitScore(cachedUsername!, score, worms);
              
              // Verify we are still on gameover screen before showing sync message
              if (!gameOverScreen.classList.contains("hidden")) {
                const syncMsg = document.createElement("div");
                syncMsg.id = "score-sync-status";
                syncMsg.style.color = "var(--success)";
                syncMsg.style.fontSize = "0.85rem";
                syncMsg.style.marginTop = "8px";
                syncMsg.style.fontWeight = "600";
                syncMsg.textContent = "Score synced automatically! 🚀";
                
                const existing = document.getElementById("score-sync-status");
                if (existing) existing.remove();
                leaderboardSubmission.parentElement!.insertBefore(syncMsg, leaderboardSubmission);
              }
            })();
          } else {
            // Signed in but no username chose yet
            leaderboardSubmission.classList.remove("hidden");
            leaderboardAuthPrompt.classList.add("hidden");
            submitScoreBtn.disabled = false;
            submitScoreBtn.textContent = "Submit";
          }
        } else {
          // Not signed in: keep track of pending run to upload on sign-in
          pendingRunScore = score;
          pendingRunWorms = worms;
          leaderboardSubmission.classList.add("hidden");
          leaderboardAuthPrompt.classList.remove("hidden");
        }
      } else {
        leaderboardSubmission.classList.add("hidden");
        leaderboardAuthPrompt.classList.add("hidden");
        // Remove auto-sync message if any exists
        const existing = document.getElementById("score-sync-status");
        if (existing) existing.remove();
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

function showLeaderboardScreen() {
  // Hide other screens
  startScreen.classList.add("hidden");
  pauseScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
  configScreen.classList.add("hidden");
  
  // Show leaderboard screen
  leaderboardScreen.classList.remove("hidden");
  
  // Load ranking scores
  loadLeaderboard();
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
  const loadingHtml = '<li class="loading-item">Fetching ranking...</li>';
  leaderboardList.innerHTML = loadingHtml;
  globalLeaderboardList.innerHTML = loadingHtml;
  
  const statusText = isFirebaseConnected() ? "Global (DB)" : "Offline (Local)";
  leaderboardTypeLabel.textContent = statusText;
  globalLeaderboardTypeLabel.textContent = statusText;
  if (isFirebaseConnected()) {
    leaderboardTypeLabel.classList.add("online");
    globalLeaderboardTypeLabel.classList.add("online");
  } else {
    leaderboardTypeLabel.classList.remove("online");
    globalLeaderboardTypeLabel.classList.remove("online");
  }

  try {
    const { isGlobal, scores } = await getLeaderboard();
    
    // Update badge type dynamically if it changed during load
    const actualStatusText = isGlobal ? "Global (DB)" : "Offline (Local)";
    leaderboardTypeLabel.textContent = actualStatusText;
    globalLeaderboardTypeLabel.textContent = actualStatusText;
    if (isGlobal) {
      leaderboardTypeLabel.classList.add("online");
      globalLeaderboardTypeLabel.classList.add("online");
    } else {
      leaderboardTypeLabel.classList.remove("online");
      globalLeaderboardTypeLabel.classList.remove("online");
    }

    if (scores.length === 0) {
      const emptyHtml = '<li class="loading-item">No records yet! Be the first!</li>';
      leaderboardList.innerHTML = emptyHtml;
      globalLeaderboardList.innerHTML = emptyHtml;
      return;
    }

    leaderboardList.innerHTML = "";
    globalLeaderboardList.innerHTML = "";

    const createScoreItem = (entry: any) => {
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
      wormsSpan.innerHTML = `
        <svg class="svg-icon bug" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 2px;">
          <rect width="8" height="14" x="8" y="5" rx="4"></rect>
          <path d="m19 7-3 2"></path>
          <path d="m5 7 3 2"></path>
          <path d="m19 19-3-2"></path>
          <path d="m5 19 3-2"></path>
          <path d="M20 13h-4"></path>
          <path d="M4 13h4"></path>
          <path d="m10 4 1 2"></path>
          <path d="m14 4-1 2"></path>
        </svg>
        ${entry.worms}
      `;

      detailsDiv.appendChild(scoreSpan);
      detailsDiv.appendChild(wormsSpan);

      li.appendChild(infoDiv);
      li.appendChild(detailsDiv);
      return li;
    };

    scores.forEach((entry) => {
      leaderboardList.appendChild(createScoreItem(entry));
      globalLeaderboardList.appendChild(createScoreItem(entry));
    });
  } catch (err) {
    console.error("Leaderboard render error", err);
    const errorHtml = '<li class="loading-item">Failed to load leaderboard</li>';
    leaderboardList.innerHTML = errorHtml;
    globalLeaderboardList.innerHTML = errorHtml;
  }
}

function updateAuthUI() {
  if (!isFirebaseConnected()) {
    // If Firebase is not connected, hide profile and auth elements
    profileContainer.classList.add("hidden");
    leaderboardAuthPrompt.classList.add("hidden");
    return;
  }

  profileContainer.classList.remove("hidden");

  if (currentUser) {
    // User is logged in
    profileUnauth.classList.add("hidden");
    profileAuth.classList.remove("hidden");
    
    const displayName = currentUser.displayName || currentUser.email?.split('@')[0] || "Flyer";
    profileUsername.textContent = displayName;
    
    // Autofill name on Game Over screen
    const savedName = localStorage.getItem("find_my_worm_player_name");
    playerNameInput.value = savedName || displayName.substring(0, 10);
    usernameErrorMsg.classList.add("hidden");

    // Toggle Game Over submission panel
    leaderboardAuthPrompt.classList.add("hidden");
    const score = Number(finalScoreVal.textContent) || 0;
    if (score > 0 && !gameOverScreen.classList.contains("hidden")) {
      leaderboardSubmission.classList.remove("hidden");
    }
  } else {
    // User is logged out
    profileUnauth.classList.remove("hidden");
    profileAuth.classList.add("hidden");
    usernameErrorMsg.classList.add("hidden");
    
    // Toggle Game Over submission panel
    leaderboardSubmission.classList.add("hidden");
    const score = Number(finalScoreVal.textContent) || 0;
    if (score > 0 && !gameOverScreen.classList.contains("hidden")) {
      leaderboardAuthPrompt.classList.remove("hidden");
    }
  }
}

// Start Application on Load
window.addEventListener("DOMContentLoaded", () => {
  init();
});
