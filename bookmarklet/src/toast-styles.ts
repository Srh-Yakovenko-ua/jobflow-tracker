import { SHARED } from './shared-data.js';

const { look } = SHARED;

export const TOAST_STYLES =
  ':host{all:initial!important}' +
  `[role]{${look.light};position:fixed;top:16px;right:16px;z-index:2147483647;box-sizing:border-box;display:flex;align-items:flex-start;gap:4px;width:min(360px,calc(100vw - 32px));padding:14px 6px 14px 16px;border-radius:${look.radius};background:var(--s);color:var(--i);font:600 14px/1.35 ${look.font},system-ui,sans-serif;box-shadow:${look.shadow},inset 0 0 0 1px var(--l)}` +
  'div div{flex:1;min-width:0;display:grid;justify-items:start;gap:2px}' +
  'p{margin:0}' +
  'p+p{font-weight:400;font-size:12.5px;line-height:1.5;color:var(--m)}' +
  'a{display:flex;align-items:center;min-height:44px;margin:0 -7px -14px;padding:0 7px;font-size:13px;color:var(--k);text-decoration:none}' +
  'button{all:unset;flex:none;display:grid;place-items:center;width:44px;height:44px;margin:-10px 0;color:var(--m);cursor:pointer}' +
  'a,button{border-radius:8px}' +
  ':is(a,button):hover{background:var(--t)}' +
  ':focus-visible{outline:2px solid var(--a);outline-offset:2px}' +
  'svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round}' +
  '@keyframes t{from{transform:translateY(-14px) scale(.96)}}' +
  `@media(prefers-color-scheme:dark){[role]{${look.dark}}}` +
  `@media(prefers-reduced-motion:no-preference){[role]{animation:t ${look.spring}}a,button{transition:background ${look.hover}}}`;
