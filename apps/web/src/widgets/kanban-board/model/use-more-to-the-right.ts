import { type RefObject, useEffect, useState } from 'react';

const EDGE_PX = 1;

function hasMoreToTheRight(scroller: HTMLElement): boolean {
  return scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - EDGE_PX;
}

export function useMoreToTheRight(ref: RefObject<HTMLElement | null>): boolean {
  const [more, setMore] = useState(false);
  useEffect(() => {
    const scroller = ref.current;
    if (scroller === null) return undefined;
    const update = () => {
      setMore(hasMoreToTheRight(scroller));
    };
    update();
    const resizes = new ResizeObserver(update);
    resizes.observe(scroller);
    if (scroller.firstElementChild !== null) resizes.observe(scroller.firstElementChild);
    scroller.addEventListener('scroll', update, { passive: true });
    return () => {
      resizes.disconnect();
      scroller.removeEventListener('scroll', update);
    };
  }, [ref]);
  return more;
}
