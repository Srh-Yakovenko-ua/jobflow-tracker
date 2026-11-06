'use client';

import { usePathname } from 'next/navigation';
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  use,
  useEffect,
  useRef,
  useState,
} from 'react';

export type PageCommand = Readonly<{
  id: string;
  label: string;
  keywords?: readonly string[];
  run: () => void;
}>;

export type PageCommandsProviderProps = Readonly<{ children: ReactNode }>;

type RegisteredCommand = PageCommand & Readonly<{ pathname: string }>;

type SetPageCommands = Dispatch<SetStateAction<readonly RegisteredCommand[]>>;

const PageCommandsContext = createContext<readonly RegisteredCommand[]>([]);

const SetPageCommandsContext = createContext<SetPageCommands | null>(null);

export function PageCommandsProvider({ children }: PageCommandsProviderProps) {
  const [commands, setCommands] = useState<readonly RegisteredCommand[]>([]);
  return (
    <SetPageCommandsContext value={setCommands}>
      <PageCommandsContext value={commands}>{children}</PageCommandsContext>
    </SetPageCommandsContext>
  );
}

export function usePageCommands(): readonly PageCommand[] {
  const pathname = usePathname();
  return use(PageCommandsContext).filter((command) => command.pathname === pathname);
}

export function useRegisterPageCommand(command: PageCommand): void {
  const setCommands = use(SetPageCommandsContext);
  const [pathname] = useState(usePathname());
  const latestRef = useRef(command);
  useEffect(() => {
    latestRef.current = command;
  });
  const { id, label } = command;
  useEffect(() => {
    if (setCommands === null) return undefined;
    const registered: RegisteredCommand = {
      ...latestRef.current,
      pathname,
      run: () => {
        latestRef.current.run();
      },
    };
    setCommands((current) => [...current.filter((entry) => entry.id !== id), registered]);
    return () => {
      setCommands((current) => current.filter((entry) => entry !== registered));
    };
  }, [setCommands, id, label, pathname]);
}
