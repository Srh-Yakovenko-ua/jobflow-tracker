export type ChoiceChange<Value extends string> = Readonly<{
  options: readonly { value: Value }[];
  onValueChange: (value: Value) => void;
}>;

export function choiceChangeOf<Value extends string>({
  options,
  onValueChange,
}: ChoiceChange<Value>): (next: string) => void {
  return (next) => {
    const picked = options.find((option) => option.value === next);
    if (picked) onValueChange(picked.value);
  };
}
