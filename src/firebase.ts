import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, Firestore } from "firebase/firestore";

interface ScoreEntry {
  name: string;
  score: number;
  worms: number;
  timestamp: number;
}

export interface LeaderboardItem {
  rank: number;
  name: string;
  score: number;
  worms: number;
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let isConnected = false;

// 1. Get Firebase configuration from env or localStorage
export function getFirebaseConfig(): Record<string, string> | null {
  // Try localStorage first (browser dynamic config)
  const localConfigStr = localStorage.getItem("find_my_worm_firebase_config");
  if (localConfigStr) {
    try {
      const config = JSON.parse(localConfigStr);
      if (config.apiKey && config.projectId) {
        return config;
      }
    } catch (e) {
      console.error("Failed to parse stored Firebase config", e);
    }
  }

  // Fall back to environment variables
  const envConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  };

  if (envConfig.apiKey && envConfig.projectId) {
    return envConfig;
  }

  return null;
}

// 2. Initialize Firebase
export async function initializeFirebase(customConfig?: Record<string, string>): Promise<boolean> {
  try {
    const config = customConfig || getFirebaseConfig();
    
    if (!config) {
      console.log("Firebase connection skipped: No API key/Project ID found. Using Local storage.");
      isConnected = false;
      db = null;
      app = null;
      return false;
    }

    // Check if app already initialized
    if (getApps().length > 0 && !customConfig) {
      app = getApp();
    } else {
      // If dynamic config provided, we initialize a new instance or reuse
      app = initializeApp(config);
    }

    db = getFirestore(app);
    isConnected = true;
    console.log("Firebase Firestore initialized successfully!");
    return true;
  } catch (err) {
    console.error("Failed to initialize Firebase", err);
    isConnected = false;
    db = null;
    app = null;
    return false;
  }
}

// 3. Save Firebase config to localStorage
export function saveFirebaseConfig(config: Record<string, string>): void {
  localStorage.setItem("find_my_worm_firebase_config", JSON.stringify(config));
}

// 4. Clear Firebase config
export function clearFirebaseConfig(): void {
  localStorage.removeItem("find_my_worm_firebase_config");
}

// 5. Check if Firebase is active
export function isFirebaseConnected(): boolean {
  return isConnected && db !== null;
}

/* ==========================================================================
   Leaderboard Operations (Firestore with LocalStorage fallback)
   ========================================================================== */

const LOCAL_STORAGE_KEY = "find_my_worm_local_scores";

// Local storage helpers
function getLocalScores(): ScoreEntry[] {
  const scoresStr = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!scoresStr) return [];
  try {
    return JSON.parse(scoresStr);
  } catch {
    return [];
  }
}

function saveLocalScore(entry: ScoreEntry): void {
  const scores = getLocalScores();
  scores.push(entry);
  
  // Sort: score desc, worms desc, then timestamp desc
  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.worms !== a.worms) return b.worms - a.worms;
    return b.timestamp - a.timestamp;
  });

  // Keep top 15 locally
  const topScores = scores.slice(0, 15);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(topScores));
}

// Save score to Firestore or LocalStorage fallback
export async function submitScore(
  name: string,
  score: number,
  worms: number
): Promise<{ success: boolean; isGlobal: boolean }> {
  const entry: ScoreEntry = {
    name: name.substring(0, 12).trim() || "Birdy",
    score,
    worms,
    timestamp: Date.now(),
  };

  // Always save locally as a backup
  saveLocalScore(entry);

  if (isFirebaseConnected() && db) {
    try {
      await addDoc(collection(db, "leaderboard"), entry);
      return { success: true, isGlobal: true };
    } catch (err) {
      console.warn("Firestore save failed, fell back to local storage", err);
      return { success: true, isGlobal: false };
    }
  }

  return { success: true, isGlobal: false };
}

// Fetch top 10 leaderboard entries
export async function getLeaderboard(): Promise<{
  isGlobal: boolean;
  scores: LeaderboardItem[];
}> {
  if (isFirebaseConnected() && db) {
    try {
      const q = query(
        collection(db, "leaderboard"),
        orderBy("score", "desc"),
        limit(10)
      );
      
      const querySnapshot = await getDocs(q);
      const scores: LeaderboardItem[] = [];
      let rank = 1;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        scores.push({
          rank: rank++,
          name: data.name || "Anonymous",
          score: Number(data.score) || 0,
          worms: Number(data.worms) || 0,
        });
      });

      if (scores.length > 0) {
        return { isGlobal: true, scores };
      }
      // If Firestore exists but collection is empty, show empty list or fallback
    } catch (err) {
      console.warn("Firestore fetch failed, loading local leaderboard", err);
    }
  }

  // Fallback: Local Leaderboard
  const localScores = getLocalScores();
  const scores: LeaderboardItem[] = localScores.map((s, idx) => ({
    rank: idx + 1,
    name: s.name,
    score: s.score,
    worms: s.worms,
  })).slice(0, 10);

  return { isGlobal: false, scores };
}
