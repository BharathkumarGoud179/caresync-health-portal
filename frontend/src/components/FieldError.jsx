export default function FieldError({ id, message }) {
  return (
    <div className={`invalid-feedback ${message ? 'd-block' : ''}`} id={id}>
      {message || ''}
    </div>
  );
}
