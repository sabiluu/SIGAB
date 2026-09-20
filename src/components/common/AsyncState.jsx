export function LoadingState({ label = 'Memuat data...' }) {
  return <div className="async-state" role="status"><span className="loading-spinner" />{label}</div>
}

export function ErrorState({ message = 'Data belum dapat dimuat.', onRetry }) {
  return <div className="async-state async-error" role="alert"><strong>Terjadi kendala</strong><span>{message}</span>{onRetry && <button type="button" onClick={onRetry}>Coba lagi</button>}</div>
}

export function EmptyState({ title = 'Belum ada data', message = 'Data akan tampil setelah tersedia.' }) {
  return <div className="async-state async-empty" role="status"><strong>{title}</strong><span>{message}</span></div>
}
