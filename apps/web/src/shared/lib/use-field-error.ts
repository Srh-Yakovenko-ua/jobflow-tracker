import { type Control, type FieldPath, type FieldValues, useFormState } from 'react-hook-form';

export type FieldErrorLookup<
  Values extends FieldValues,
  Output,
  Name extends FieldPath<Values>,
> = Readonly<{
  control: Control<Values, unknown, Output>;
  name: Name;
  messages: Readonly<Record<Name, string>>;
}>;

export function useFieldError<Values extends FieldValues, Output, Name extends FieldPath<Values>>({
  control,
  name,
  messages,
}: FieldErrorLookup<Values, Output, Name>): string | undefined {
  const formState = useFormState({ control, name });
  return control.getFieldState(name, formState).invalid ? messages[name] : undefined;
}
