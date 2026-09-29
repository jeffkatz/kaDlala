const QUESTION_FILES = import.meta.glob('../data/questions/*.json', {
  eager: true,
  import: 'default'
});

export const QUESTION_BANKS = Object.values(QUESTION_FILES).sort((first, second) => (
  first.category.localeCompare(second.category)
));

export const QUESTION_CATEGORIES = QUESTION_BANKS.map((bank) => bank.category);
export const QUESTION_DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

export function getBundledQuestions() {
  return QUESTION_BANKS.flatMap((bank) => bank.questions);
}

export function isValidQuestionBank(value) {
  if (
    !value
    || value.schemaVersion !== 1
    || typeof value.category !== 'string'
    || typeof value.reviewedAt !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(value.reviewedAt)
    || !Array.isArray(value.sources)
    || value.sources.length === 0
    || value.sources.some((source) => {
      try {
        return !['http:', 'https:'].includes(new URL(source).protocol);
      } catch {
        return true;
      }
    })
    || !Array.isArray(value.questions)
    || value.questions.length === 0
  ) {
    return false;
  }

  return value.questions.every((question) => (
    question
    && typeof question.id === 'string'
    && question.id.length > 0
    && question.category === value.category
    && typeof question.text === 'string'
    && question.text.trim().length > 0
    && QUESTION_DIFFICULTIES.includes(question.difficulty)
    && Number.isInteger(question.points)
    && question.points > 0
    && Number.isInteger(question.timeLimit)
    && question.timeLimit >= 5
    && question.timeLimit <= 60
    && typeof question.explanation === 'string'
    && question.explanation.trim().length > 0
    && Array.isArray(question.options)
    && question.options.length === 4
    && question.options.every((option) => (
      option
      && typeof option.id === 'string'
      && typeof option.text === 'string'
      && option.text.trim().length > 0
    ))
    && question.options.filter((option) => option.isCorrect === true).length === 1
  ));
}

export function validateQuestionBank(value, existingQuestions = []) {
  if (!value || typeof value !== 'object') {
    return 'File must contain a JSON object.';
  }
  if (value.schemaVersion !== 1) {
    return 'schemaVersion must be 1.';
  }
  if (typeof value.category !== 'string' || !value.category.trim()) {
    return 'category must be a non-empty string.';
  }
  if (typeof value.reviewedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.reviewedAt)) {
    return 'reviewedAt must be a date in YYYY-MM-DD format.';
  }
  if (!Array.isArray(value.sources) || value.sources.length === 0) {
    return 'sources must contain at least one authoritative HTTP(S) URL.';
  }
  if (value.sources.some((source) => {
    try {
      return typeof source !== 'string' || !['http:', 'https:'].includes(new URL(source).protocol);
    } catch {
      return true;
    }
  })) {
    return 'Every source must be an authoritative HTTP(S) URL.';
  }
  if (!Array.isArray(value.questions) || value.questions.length === 0) {
    return 'questions must be a non-empty array.';
  }
  if (value.questions.length > 250) {
    return 'A category file can contain at most 250 questions.';
  }

  const existingIds = new Set(existingQuestions.map((question) => question.id));
  for (const [index, question] of value.questions.entries()) {
    const label = `questions[${index}]`;
    if (!question || typeof question !== 'object') return `${label} must be an object.`;
    if (typeof question.id !== 'string' || !question.id.trim()) return `${label}.id is required.`;
    if (existingIds.has(question.id)) return `${label}.id "${question.id}" already exists.`;
    if (question.category !== value.category) return `${label}.category must match the file category.`;
    if (typeof question.text !== 'string' || !question.text.trim()) return `${label}.text is required.`;
    if (!QUESTION_DIFFICULTIES.includes(question.difficulty)) {
      return `${label}.difficulty must be Easy, Medium, or Hard.`;
    }
    if (!Number.isInteger(question.points) || question.points < 1) {
      return `${label}.points must be a positive integer.`;
    }
    if (!Number.isInteger(question.timeLimit) || question.timeLimit < 5 || question.timeLimit > 60) {
      return `${label}.timeLimit must be an integer from 5 to 60 seconds.`;
    }
    if (typeof question.explanation !== 'string' || !question.explanation.trim()) {
      return `${label}.explanation is required.`;
    }
    if (!Array.isArray(question.options) || question.options.length !== 4) {
      return `${label}.options must contain exactly four answers.`;
    }
    const optionIds = new Set();
    for (const [optionIndex, option] of question.options.entries()) {
      if (!option || typeof option.id !== 'string' || !option.id.trim()) {
        return `${label}.options[${optionIndex}].id is required.`;
      }
      if (optionIds.has(option.id)) return `${label} contains duplicate option id "${option.id}".`;
      if (typeof option.text !== 'string' || !option.text.trim()) {
        return `${label}.options[${optionIndex}].text is required.`;
      }
      optionIds.add(option.id);
    }
    if (question.options.filter((option) => option.isCorrect === true).length !== 1) {
      return `${label}.options must have exactly one answer with isCorrect: true.`;
    }

    existingIds.add(question.id);
  }

  return null;
}

export function buildQuestionFileExample(category = 'Local Knowledge') {
  return {
    schemaVersion: 1,
    category,
    reviewedAt: new Date().toISOString().slice(0, 10),
    sources: ['https://www.gov.za/about-sa/south-africa-glance'],
    questions: [
      {
        id: 'local_001',
        category,
        difficulty: 'Medium',
        points: 200,
        text: 'Replace this with a South African quiz question.',
        options: [
          { id: 'local_001_a', text: 'Answer A', isCorrect: true },
          { id: 'local_001_b', text: 'Answer B' },
          { id: 'local_001_c', text: 'Answer C' },
          { id: 'local_001_d', text: 'Answer D' }
        ],
        explanation: 'Explain why the correct answer is right.',
        timeLimit: 12
      }
    ]
  };
}
