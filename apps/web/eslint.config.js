import { web } from '@jobflow/config/eslint';

export default [
  ...web(import.meta.dirname),
  {
    files: ['src/widgets/kanban-board/model/use-column-virtualizer.ts'],
    rules: { 'react-hooks/incompatible-library': 'off' },
  },
];
