import { useMemo, useState } from 'react';
import { getBundledQuestions, isValidQuestionBank, validateQuestionBank } from '../lib/questions';

const STORAGE_KEY = 'kadlala-custom-question-banks-v1';

function loadCustomBanks() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(stored)) throw new Error('Saved custom question files are not a list.');
    const validBanks = stored.filter(isValidQuestionBank);
    if (validBanks.length !== stored.length) {
      console.warn('Some saved custom question files are invalid and were skipped.');
    }
    return validBanks;
  } catch (error) {
    console.warn('Could not load saved kaDlala question files.', error);
    return [];
  }
}

export default function useQuestionLibrary() {
  const [customBanks, setCustomBanks] = useState(loadCustomBanks);
  const bundledQuestions = useMemo(() => getBundledQuestions(), []);
  const customQuestions = useMemo(() => customBanks.flatMap((bank) => bank.questions), [customBanks]);
  const allQuestions = useMemo(() => [...bundledQuestions, ...customQuestions], [bundledQuestions, customQuestions]);
  const categories = useMemo(
    () => [...new Set(allQuestions.map((question) => question.category))].sort(),
    [allQuestions]
  );

  function addQuestionBank(bank) {
    const error = validateQuestionBank(bank, allQuestions);
    if (error) return { error };

    const nextBanks = [...customBanks, bank];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextBanks));
    } catch (storageError) {
      console.error('Could not save the imported question file.', storageError);
      return { error: 'This question file could not be saved in this browser. Check available storage and try again.' };
    }

    setCustomBanks(nextBanks);
    return { added: bank.questions.length, category: bank.category };
  }

  return { questions: allQuestions, categories, addQuestionBank, customBanks };
}
