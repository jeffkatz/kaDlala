export function shuffle(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

function getDifficultyPlan(questionCount) {
  const plans = {
    5: ['Easy', 'Easy', 'Medium', 'Medium', 'Hard'],
    10: ['Easy', 'Easy', 'Easy', 'Medium', 'Medium', 'Medium', 'Hard', 'Hard', 'Hard', 'Hard'],
    15: ['Easy', 'Easy', 'Easy', 'Easy', 'Medium', 'Medium', 'Medium', 'Medium', 'Medium', 'Hard', 'Hard', 'Hard', 'Hard', 'Hard', 'Hard']
  };

  return plans[questionCount] || Array.from({ length: questionCount }, (_item, index) => (
    index < Math.ceil(questionCount / 3)
      ? 'Easy'
      : index < Math.ceil((questionCount * 2) / 3)
        ? 'Medium'
        : 'Hard'
  ));
}

function getCategoryQuotas(categories, percentages, questionCount) {
  const shares = categories.map((category) => {
    const exactShare = ((percentages[category] || 0) * questionCount) / 100;
    return { category, count: Math.floor(exactShare), remainder: exactShare % 1 };
  });
  let unassigned = questionCount - shares.reduce((total, share) => total + share.count, 0);
  [...shares]
    .sort((first, second) => second.remainder - first.remainder)
    .slice(0, unassigned)
    .forEach((share) => {
      share.count += 1;
      unassigned -= 1;
    });

  return new Map(shares.map(({ category, count }) => [category, count]));
}

export function createGameDeck(questions, percentages, questionCount) {
  const count = Math.min(questionCount, questions.length);
  if (count === 0) return [];

  const quotas = getCategoryQuotas(
    [...new Set(questions.map((question) => question.category))],
    percentages,
    count
  );
  const selectedByCategory = new Map();
  const selectedIds = new Set();
  const selectedQuestions = [];
  const categoryOrder = shuffle([...quotas.keys()]);
  const difficultyPlan = getDifficultyPlan(count);

  difficultyPlan.forEach((difficulty) => {
    const eligible = shuffle(questions.filter((question) => (
      question.difficulty === difficulty && !selectedIds.has(question.id)
    )));
    const preferred = categoryOrder
      .filter((category) => (
        (selectedByCategory.get(category) || 0) < (quotas.get(category) || 0)
      ))
      .map((category) => eligible.find((question) => question.category === category))
      .find(Boolean);
    const question = preferred || eligible[0];

    if (question) {
      selectedIds.add(question.id);
      selectedByCategory.set(
        question.category,
        (selectedByCategory.get(question.category) || 0) + 1
      );
      selectedQuestions.push(question);
    }
  });

  if (selectedQuestions.length < count) {
    const remaining = shuffle(questions.filter((question) => !selectedIds.has(question.id)));
    remaining.slice(0, count - selectedQuestions.length).forEach((question) => {
      selectedIds.add(question.id);
      selectedQuestions.push(question);
    });
  }

  return selectedQuestions.map((question) => ({
    ...question,
    options: shuffle(question.options)
  }));
}
