import { useMemo, useState } from 'react';

const STORAGE_KEY = 'kadlala-game-settings-v1';

function makeEqualWeights(categories) {
  if (categories.length === 0) return {};
  const base = Math.floor(100 / categories.length);
  let remainder = 100 % categories.length;
  return Object.fromEntries(categories.map((category) => {
    const weight = base + (remainder > 0 ? 1 : 0);
    remainder -= 1;
    return [category, weight];
  }));
}

function loadSettings() {
  try {
    const savedSettings = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      questionCount: [5, 10, 15].includes(savedSettings.questionCount)
        ? savedSettings.questionCount
        : 10,
      categoryPercentages: savedSettings.categoryPercentages || {}
    };
  } catch (error) {
    console.warn('Could not load saved kaDlala game settings.', error);
    return { questionCount: 10, categoryPercentages: {} };
  }
}

function persistSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Could not save kaDlala game settings.', error);
  }
}

export default function useGameSettings(categories) {
  const [savedSettings, setSavedSettings] = useState(loadSettings);
  const categoryPercentages = useMemo(() => {
    const available = new Set(categories);
    const current = Object.fromEntries(
      Object.entries(savedSettings.categoryPercentages)
        .filter(([category, value]) => available.has(category) && Number.isInteger(value) && value >= 0)
    );
    const missing = categories.filter((category) => !(category in current));

    if (missing.length === 0) {
      const knownTotal = Object.values(current).reduce((total, value) => total + value, 0);
      return knownTotal === 100 ? current : makeEqualWeights(categories);
    }

    if (Object.keys(current).length === 0) return makeEqualWeights(categories);

    const newCategoryShare = Math.min(10, Math.floor(100 / (categories.length * 2)));
    const remainingShare = 100 - (newCategoryShare * missing.length);
    const currentTotal = Object.values(current).reduce((total, value) => total + value, 0);
    const existingShares = Object.fromEntries(Object.entries(current).map(([category, value]) => [
      category,
      Math.floor((value / currentTotal) * remainingShare)
    ]));
    let remainder = remainingShare - Object.values(existingShares).reduce((total, value) => total + value, 0);
    Object.keys(existingShares).forEach((category) => {
      if (remainder > 0) {
        existingShares[category] += 1;
        remainder -= 1;
      }
    });

    return {
      ...existingShares,
      ...Object.fromEntries(missing.map((category) => [category, newCategoryShare]))
    };
  }, [categories, savedSettings.categoryPercentages]);

  function saveSettings(nextSettings) {
    setSavedSettings(nextSettings);
    persistSettings(nextSettings);
  }

  function updateCategoryPercentages(nextPercentages) {
    saveSettings({ ...savedSettings, categoryPercentages: nextPercentages });
  }

  function updateQuestionCount(questionCount) {
    if (![5, 10, 15].includes(questionCount)) {
      throw new Error('Question count must be 5, 10, or 15.');
    }
    saveSettings({ ...savedSettings, questionCount, categoryPercentages });
  }

  return {
    questionCount: savedSettings.questionCount,
    categoryPercentages,
    updateCategoryPercentages,
    updateQuestionCount
  };
}
