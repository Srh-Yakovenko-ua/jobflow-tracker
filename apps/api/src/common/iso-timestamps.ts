type Timestamped = { createdAt: Date; updatedAt: Date };

export function withIsoTimestamps<Row extends Timestamped>({ createdAt, updatedAt, ...row }: Row) {
  return { ...row, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() };
}
