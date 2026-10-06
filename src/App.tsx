import { getRank, rankBySlug } from './domain/ranks';
import { pendingToday } from './domain/selectors';
import { useAppState } from './state/useAppState';
import { navigate, parseRoute, useHash } from './state/useHash';
import { Header } from './ui/Header';
import { RankPage } from './ui/RankPage';
import { TaskGrid } from './ui/TaskGrid';

export default function App() {
  const { state, today, complete, undo, rename, addTask, editTask, removeTask, undoRemove, addImage, updateImage, deleteImage } =
    useAppState();
  const route = parseRoute(useHash());

  if (route.page === 'rank') {
    const rank = rankBySlug(route.slug) ?? getRank(state.points).current;
    return (
      <main className="app">
        <RankPage state={state} rank={rank} onNavigate={navigate} />
      </main>
    );
  }

  return (
    <main className="app">
      <Header
        playerName={state.playerName}
        points={state.points}
        pending={pendingToday(state, today)}
        weekNumber={state.weekNumber}
        onRename={rename}
      />
      <TaskGrid
        state={state}
        today={today}
        onComplete={complete}
        onUndo={undo}
        onAddTask={addTask}
        onEditTask={editTask}
        onRemoveTask={removeTask}
        onUndoRemove={undoRemove}
        onAddImage={addImage}
        onUpdateImage={updateImage}
        onDeleteImage={deleteImage}
      />
    </main>
  );
}
