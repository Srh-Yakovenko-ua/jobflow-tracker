function useStageCount(): number {
  return 1;
}

export function StageCounter({ visible }: { visible: boolean }) {
  if (visible) {
    const count = useStageCount();
    return <p>{count}</p>;
  }
  return <img src="/empty-board.png" alt="" />;
}
