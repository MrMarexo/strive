import { mondayOf } from './domain/dates';
import { pendingToday } from './domain/selectors';
import { useAppState } from './state/useAppState';
import { Header } from './ui/Header';
import { TaskGrid } from './ui/TaskGrid';

export default function App() {
  const { state, today, complete, undo } = useAppState();
  return (
    <main className="app">
      <Header points={state.points} pending={pendingToday(state, today)} weekStart={mondayOf(today)} />
      <TaskGrid state={state} today={today} onComplete={complete} onUndo={undo} />
    </main>
  );
}
