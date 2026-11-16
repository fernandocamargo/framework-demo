import { Button } from 'react-aria-components';

export default ({
  closeWizard,
  current,
  failedCount,
  i18n,
  progress,
  results,
  retryFailed,
  retryText,
  summary,
  summaryText,
}) => (
  <>
    {summary ? (
      <div role="status">
        <link
          href={failedCount ? 'https://schema.org/FailedActionStatus' : 'https://schema.org/CompletedActionStatus'}
          itemProp="actionStatus"
        />
        <p>{summaryText}</p>
      </div>
    ) : (
      <p>
        <span>{current ?? progress.text}</span>
        <progress aria-label={i18n.progress.label} max={progress.total} value={progress.value}>
          {progress.text}
        </progress>
      </p>
    )}
    <ul aria-label={i18n.results}>
      {results.map((result) => (
        <li itemScope itemType="https://schema.org/ReplaceAction" key={result.id}>
          <link
            href={
              result.error === null
                ? 'https://schema.org/CompletedActionStatus'
                : 'https://schema.org/FailedActionStatus'
            }
            itemProp="actionStatus"
          />
          <span itemProp="object">{result.title}</span>
          {result.error === null ? (
            <span>
              <span itemProp="replacee">{result.from}</span> → <strong itemProp="replacer">{result.to}</strong>
            </span>
          ) : (
            <span itemProp="error">{result.error}</span>
          )}
        </li>
      ))}
    </ul>
    {summary && (
      <footer>
        {failedCount > 0 && <Button onPress={retryFailed}>{retryText}</Button>}
        <Button onPress={closeWizard}>{i18n.done}</Button>
      </footer>
    )}
  </>
);
