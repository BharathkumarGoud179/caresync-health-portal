export default function PageLoader({ label = 'Loading...' }) {
  return (
    <div className="d-flex flex-column justify-content-center align-items-center vh-100 text-muted">
      <span className="spinner-border text-teal" role="status" aria-hidden="true" />
      <span className="mt-3 small">{label}</span>
    </div>
  );
}
