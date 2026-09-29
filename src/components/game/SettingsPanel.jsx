import { useMemo, useState } from 'react';
import {
  buildQuestionFileExample,
  validateQuestionBank
} from '../../lib/questions';

function balanceWeights(weights, changedCategory, nextValue) {
  const categories = Object.keys(weights);
  const remaining = categories.filter((category) => category !== changedCategory);
  const available = 100 - nextValue;
  const currentTotal = remaining.reduce((total, category) => total + weights[category], 0);
  const nextWeights = { ...weights, [changedCategory]: nextValue };

  if (remaining.length === 0) return nextWeights;

  const shares = remaining.map((category, index) => {
    const proportionalShare = currentTotal > 0
      ? (weights[category] / currentTotal) * available
      : available / remaining.length;
    const share = Math.floor(proportionalShare);
    return { category, share, fraction: proportionalShare - share, index };
  });
  let remainder = available - shares.reduce((total, item) => total + item.share, 0);
  [...shares]
    .sort((first, second) => second.fraction - first.fraction || first.index - second.index)
    .slice(0, remainder)
    .forEach((item) => {
      item.share += 1;
      remainder -= 1;
    });

  shares.forEach(({ category, share }) => {
    nextWeights[category] = share;
  });

  return nextWeights;
}

export default function SettingsPanel({
  categories,
  questions,
  weights,
  questionCount,
  onClose,
  onUpdateWeights,
  onUpdateQuestionCount,
  onGameMode,
  onAddQuestionBank
}) {
  const [importMessage, setImportMessage] = useState('');
  const [importError, setImportError] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const questionTotals = useMemo(() => categories.map((category) => ({
    category,
    count: questions.filter((question) => question.category === category).length
  })), [categories, questions]);
  const totalWeight = Object.values(weights).reduce((total, value) => total + value, 0);

  function updateWeight(category, value) {
    const nextWeights = balanceWeights(weights, category, value);
    onUpdateWeights(nextWeights);
  }

  async function handleImport(event) {
    const file = event.currentTarget.files?.[0];
    setFileInputKey((key) => key + 1);
    if (!file) return;
    if (file.size > 1_000_000) {
      setImportMessage('Question files must be smaller than 1 MB.');
      setImportError(true);
      return;
    }

    try {
      const bank = JSON.parse(await file.text());
      const validationError = validateQuestionBank(bank, questions);
      if (validationError) {
        setImportMessage(validationError);
        setImportError(true);
        return;
      }

      const result = onAddQuestionBank(bank);
      if (result.error) {
        setImportMessage(result.error);
        setImportError(true);
        return;
      }

      setImportMessage(`Added ${result.added} questions to ${result.category}.`);
      setImportError(false);
    } catch (error) {
      setImportMessage(error instanceof SyntaxError
        ? 'This file is not valid JSON.'
        : 'The question file could not be read.');
      setImportError(true);
    }
  }

  function downloadTemplate() {
    const template = buildQuestionFileExample();
    const encoded = encodeURIComponent(`${JSON.stringify(template, null, 2)}\n`);
    const link = document.createElement('a');
    link.href = `data:application/json;charset=utf-8,${encoded}`;
    link.download = 'kadlala-question-bank-template.json';
    link.click();
  }

  return (
    <section className="settings-page" aria-labelledby="settings-title">
      <div className="settings-heading">
        <div>
          <p className="eyebrow">MAKE IT YOUR GAME</p>
          <h1 id="settings-title">Round settings</h1>
          <p>Shape the mix of South African knowledge in every round.</p>
        </div>
        <button type="button" className="settings-back" onClick={onClose}>Back to game</button>
      </div>

      <div className="settings-grid">
        <section className="settings-card category-settings" aria-labelledby="category-settings-title">
          <div className="settings-card__heading">
            <div>
              <p className="eyebrow">THE KNOWLEDGE MIX</p>
              <h2 id="category-settings-title">Choose your territories</h2>
            </div>
            <span className={`weight-total${totalWeight === 100 ? '' : ' weight-total--invalid'}`} aria-live="polite">
              {totalWeight}% <small>/ 100</small>
            </span>
          </div>
          <p className="settings-description">
            Sliders always add up to 100%. Percentages guide each category’s share of questions; small rounds are rounded to the closest possible mix.
          </p>
          <div className="category-sliders">
            {questionTotals.map(({ category, count }, index) => (
              <label className="category-slider" key={category}>
                <span className="category-slider__title">
                  <span className="category-slider__name">
                    <i className="category-swatch" style={{ '--swatch-index': index }} />
                    <strong>{category}</strong>
                  </span>
                  <span className="category-slider__value">{weights[category] || 0}% <small>· {count} Qs</small></span>
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={weights[category] || 0}
                  aria-label={`${category} question percentage`}
                  aria-valuetext={`${weights[category] || 0} percent, ${count} available questions`}
                  onChange={(event) => updateWeight(category, Number(event.target.value))}
                />
              </label>
            ))}
          </div>
        </section>

        <div className="settings-aside">
          <section className="settings-card" aria-labelledby="play-mode-title">
            <p className="eyebrow">WHO'S PLAYING?</p>
            <h2 id="play-mode-title">Choose a game mode</h2>
            <div className="mode-choice">
              <button type="button" className="mode-choice__button" onClick={onGameMode}>
                <span className="mode-choice__icon" aria-hidden="true">◎</span>
                <span><strong>Play with friends</strong><small>Live online · share a room code</small></span>
                <span aria-hidden="true">↗</span>
              </button>
            </div>
          </section>

          <section className="settings-card" aria-labelledby="round-size-title">
            <p className="eyebrow">ROUND LENGTH</p>
            <h2 id="round-size-title">Questions per game</h2>
            <div className="round-size-options" role="group" aria-label="Questions per game">
              {[5, 10, 15].map((count) => (
                <button
                  key={count}
                  className={`round-size-option${questionCount === count ? ' round-size-option--selected' : ''}`}
                  type="button"
                  aria-pressed={questionCount === count}
                  onClick={() => onUpdateQuestionCount(count)}
                >
                  <strong>{count}</strong>
                  <span>{count === 5 ? 'Quick' : count === 10 ? 'Classic' : 'Marathon'}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-card import-card" aria-labelledby="question-import-title">
            <p className="eyebrow">GROW THE FIELD GUIDE</p>
            <h2 id="question-import-title">Add questions</h2>
            <p className="settings-description">
              Import a category JSON file. Question files are checked for the required schema, unique IDs, and exactly one correct answer.
            </p>
            <button type="button" className="template-link" onClick={downloadTemplate}>
              Download JSON template <span aria-hidden="true">↓</span>
            </button>
            <label className="file-picker">
              <span>Choose a question file</span>
              <input key={fileInputKey} type="file" accept=".json,application/json" onChange={handleImport} />
            </label>
            {importMessage && (
              <p className={`import-message${importError ? ' import-message--error' : ''}`} role={importError ? 'alert' : 'status'}>
                {importMessage}
              </p>
            )}
            <p className="question-library-count">{questions.length} questions across {categories.length} categories</p>
          </section>
        </div>
      </div>
    </section>
  );
}
