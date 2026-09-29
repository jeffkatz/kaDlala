import { useState } from 'react';

const STORAGE_KEY = 'kadlala-player-records';
const DEFAULT_RECORDS = { gamesPlayed: 0, bestScore: 0, bestStreak: 0 };

function loadRecords() {
  try {
    const savedRecords = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (
      savedRecords
      && Number.isInteger(savedRecords.gamesPlayed)
      && Number.isInteger(savedRecords.bestScore)
      && Number.isInteger(savedRecords.bestStreak)
    ) {
      return savedRecords;
    }
  } catch (error) {
    console.warn('Could not load kaDlala player records.', error);
  }

  return DEFAULT_RECORDS;
}

export default function useGameRecords() {
  const [records, setRecords] = useState(loadRecords);
  const [newPersonalBest, setNewPersonalBest] = useState(false);

  function recordGame(score, bestStreak) {
    const isNewPersonalBest = score > records.bestScore;
    const updatedRecords = {
      gamesPlayed: records.gamesPlayed + 1,
      bestScore: Math.max(records.bestScore, score),
      bestStreak: Math.max(records.bestStreak, bestStreak)
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecords));
    } catch (error) {
      console.warn('Could not save kaDlala player records.', error);
    }

    setRecords(updatedRecords);
    setNewPersonalBest(isNewPersonalBest);
    return updatedRecords;
  }

  function resetRunRecord() {
    setNewPersonalBest(false);
  }

  return { records, recordGame, newPersonalBest, resetRunRecord };
}
