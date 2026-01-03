interface FieldErrorProps {
  id: string;
  error?: string[];
}

export function FieldError({ id, error }: FieldErrorProps) {
  if (!error || error.length === 0) {
    return null;
  }

  return (
    <p id={id} className="text-sm text-red-600" role="alert">
      {error[0]}
    </p>
  );
}
