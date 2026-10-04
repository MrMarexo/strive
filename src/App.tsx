import { pendingToday } from './domain/selectors';
import { useAppState } from './state/useAppState';
import { Header } from './ui/Header';
import { TaskGrid } from './ui/TaskGrid';

export default function App() {
  const { state, today, complete, undo, rename } = useAppState();
  return (
    <main className="app">
      <Header
        playerName={state.playerName}
        points={state.points}
        pending={pendingToday(state, today)}
        weekNumber={state.weekNumber}
        onRename={rename}
      />
      <TaskGrid state={state} today={today} onComplete={complete} onUndo={undo} />
    </main>
  );
}
