import { challenges } from "@/data/challenges";
import type { Challenge, RawUserProfile, SaveData } from "@/data/types";
import {
  applySaveData,
  extractSaveData,
  parseXml,
  serializeXml,
} from "./xml-parser";

/**
 * Load and parse a save file from XML string
 */
export function loadSaveFile(xmlString: string): {
  raw: RawUserProfile;
  saveData: SaveData;
} {
  const raw = parseXml(xmlString);
  const saveData = extractSaveData(raw);
  return { raw, saveData };
}

/**
 * Update lunar coins in save data
 */
export function updateCoins(saveData: SaveData, coins: number): SaveData {
  return {
    ...saveData,
    coins: Math.max(0, coins),
  };
}

/**
 * Check if an achievement is unlocked
 */
export function isAchievementUnlocked(
  saveData: SaveData,
  achievementId: string,
): boolean {
  return saveData.achievements.includes(achievementId);
}

/**
 * Toggle an achievement (unlock or lock)
 */
export function toggleAchievement(
  saveData: SaveData,
  achievementId: string,
  enabled: boolean,
): SaveData {
  const achievements = new Set(saveData.achievements);
  const unviewedAchievements = new Set(saveData.unviewedAchievements);
  const viewedUnlockables = new Set(saveData.viewedUnlockables);
  const unlocks = new Set(saveData.unlocks);

  // Find the challenge data to get unlocks
  const challenge = challenges.find((c) => c.achievement === achievementId);

  if (enabled) {
    // Add achievement
    achievements.add(achievementId);
    // Add to unviewed (game will show notification)
    unviewedAchievements.add(achievementId);
    // Add unlocks to viewed unlockables and actual unlocks
    if (challenge) {
      for (const unlock of challenge.unlocks) {
        viewedUnlockables.add(unlock);
        unlocks.add(unlock);
      }
    }
  } else {
    // Remove achievement
    achievements.delete(achievementId);
    unviewedAchievements.delete(achievementId);
    // Remove from viewed unlockables and actual unlocks
    if (challenge) {
      for (const unlock of challenge.unlocks) {
        viewedUnlockables.delete(unlock);
        unlocks.delete(unlock);
      }
    }
  }

  return {
    ...saveData,
    achievements: Array.from(achievements),
    unviewedAchievements: Array.from(unviewedAchievements),
    viewedUnlockables: Array.from(viewedUnlockables),
    unlocks: Array.from(unlocks),
  };
}

/**
 * Unlock all achievements
 */
export function unlockAll(saveData: SaveData): SaveData {
  const achievements = new Set(saveData.achievements);
  const viewedUnlockables = new Set(saveData.viewedUnlockables);
  const unlocks = new Set(saveData.unlocks);

  // Add all achievements and their unlocks
  for (const challenge of challenges) {
    achievements.add(challenge.achievement);
    for (const unlock of challenge.unlocks) {
      viewedUnlockables.add(unlock);
      unlocks.add(unlock);
    }
  }

  return {
    ...saveData,
    achievements: Array.from(achievements),
    unviewedAchievements: [], // Clear unviewed since we're bulk unlocking
    viewedUnlockables: Array.from(viewedUnlockables),
    unlocks: Array.from(unlocks),
  };
}

/**
 * Lock all achievements managed by the editor.
 * Only removes achievements listed in the challenge data and the unlockables
 * they grant; logbook entries, newt statues, stages and any other unlocks the
 * game records on its own are preserved.
 */
export function lockAll(saveData: SaveData): SaveData {
  const managedAchievements = new Set(challenges.map((c) => c.achievement));
  const managedUnlocks = new Set(challenges.flatMap((c) => c.unlocks));
  const keepAchievement = (a: string) => !managedAchievements.has(a);
  const keepUnlock = (u: string) => !managedUnlocks.has(u);

  return {
    ...saveData,
    achievements: saveData.achievements.filter(keepAchievement),
    unviewedAchievements: saveData.unviewedAchievements.filter(keepAchievement),
    viewedUnlockables: saveData.viewedUnlockables.filter(keepUnlock),
    unlocks: saveData.unlocks.filter(keepUnlock),
  };
}

/**
 * Get count of unlocked achievements
 */
export function getUnlockedCount(saveData: SaveData): number {
  return saveData.achievements.length;
}

/**
 * Get count of total achievements
 */
export function getTotalCount(): number {
  return challenges.length;
}

/**
 * Generate the modified XML string for download
 */
export function generateModifiedXml(
  originalRaw: RawUserProfile,
  saveData: SaveData,
): string {
  const updatedRaw = applySaveData(originalRaw, saveData);
  return serializeXml(updatedRaw);
}

/**
 * Calculate stats about the current save
 */
export function calculateSaveStats(saveData: SaveData): {
  totalAchievements: number;
  unlockedAchievements: number;
  unlockedSurvivors: number;
  unlockedSkills: number;
  unlockedSkins: number;
  unlockedItems: number;
  unlockedArtifacts: number;
  totals: Record<Challenge["category"], number>;
} {
  const unlockedSet = new Set(saveData.achievements);
  const totals: Record<Challenge["category"], number> = {
    survivors: 0,
    skills: 0,
    skins: 0,
    items: 0,
    artifacts: 0,
  };
  let unlockedKnown = 0;

  let survivors = 0;
  let skills = 0;
  let skins = 0;
  let items = 0;
  let artifacts = 0;

  for (const challenge of challenges) {
    totals[challenge.category]++;
    if (unlockedSet.has(challenge.achievement)) {
      unlockedKnown++;
      switch (challenge.category) {
        case "survivors":
          survivors++;
          break;
        case "skills":
          skills++;
          break;
        case "skins":
          skins++;
          break;
        case "items":
          items++;
          break;
        case "artifacts":
          artifacts++;
          break;
      }
    }
  }

  return {
    totalAchievements: challenges.length,
    // Only count achievements the editor knows about, so value <= total
    unlockedAchievements: unlockedKnown,
    unlockedSurvivors: survivors,
    unlockedSkills: skills,
    unlockedSkins: skins,
    unlockedItems: items,
    unlockedArtifacts: artifacts,
    totals,
  };
}
