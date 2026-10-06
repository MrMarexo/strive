import { useRef, useState, type MouseEvent } from 'react';
import type { NewTaskInput, TaskEdit } from '../domain/actions';
import type { DateKey } from '../domain/dates';
import { remainingThisWeek, todayCount, willMiss } from '../domain/selectors';
import { findTask, taskGroup, taskStatus, type TaskDef, type TaskGroup, type TaskId } from '../domain/tasks';
import { imageUsers } from '../domain/images';
import type { AppState } from '../domain/types';
import { AddCard, NEW_TITLES } from './AddCard';
import { TaskFormDialog } from './TaskFormDialog';
import { CounterCard } from './CounterCard';
import { imageMap } from './images';
import { Modal } from './Modal';
import { TaskCard, type CardProps } from './TaskCard';

interface TaskGridProps {
  state: AppState;
  today: DateKey;
  onComplete: (id: TaskId) => void;
  onUndo: (id: TaskId) => void;
  onAddTask: (input: NewTaskInput) => void;
  onEditTask: (id: TaskId, edit: TaskEdit) => void;
  onRemoveTask: (id: TaskId) => void;
  onUndoRemove: (id: TaskId) => void;
  onAddImage: (map: string[]) => string;
  onUpdateImage: (key: string, map: string[]) => void;
  onDeleteImage: (key: string) => void;
}

const GROUPS: { id: TaskGroup; title: string; info: string }[] = [
  {
    id: 'daily',
    title: 'DAILY',
    info: 'Do each of these once every day. Done: +1 point at midnight. Missed: -2 points at midnight.',
  },
  {
    id: 'weekly',
    title: 'WEEKLY',
    info:
      'Each has a weekly target (e.g. Coding 5×) and counts at most once per day. +1 point per session at midnight. ' +
      'On Sunday night, -2 for every session short of the target.',
  },
  {
    id: 'weekly-unlimited',
    title: 'WEEKLY · NO DAY LIMIT',
    info:
      'A weekly target you can log several times a day (e.g. 3 chores today). +1 point per session up to the target; ' +
      'extras earn nothing. On Sunday night, -2 for every session short of the target.',
  },
];

type OpenModal =
  | { kind: 'group'; group: TaskGroup }
  | { kind: 'task'; id: TaskId }
  | { kind: 'add'; group: TaskGroup }
  | { kind: 'edit'; id: TaskId };

export function TaskGrid({
  state,
  today,
  onComplete,
  onUndo,
  onAddTask,
  onEditTask,
  onRemoveTask,
  onUndoRemove,
  onAddImage,
  onUpdateImage,
  onDeleteImage,
}: TaskGridProps) {
  const [modal, setModal] = useState<OpenModal | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const open = (next: OpenModal) => (event: MouseEvent<HTMLButtonElement>) => {
    opener.current = event.currentTarget;
    setModal(next);
  };
  const close = () => {
    setModal(null);
    opener.current?.focus();
  };

  const renderCard = (task: TaskDef) => {
    const status = taskStatus(task, today);
    const props: CardProps = {
      task,
      sprite: imageMap(state.customImages, task.image),
      status,
      todayCount: todayCount(state, task.id, today),
      remaining: status === 'pending' ? null : remainingThisWeek(state, task, today),
      willMiss: willMiss(state, task, today),
      onComplete: () => onComplete(task.id),
      onUndo: () => onUndo(task.id),
      onInfo: open({ kind: 'task', id: task.id }),
      onEdit: open({ kind: 'edit', id: task.id }),
    };
    return task.maxPerDay === null ? (
      <CounterCard key={task.id} {...props} />
    ) : (
      <TaskCard key={task.id} {...props} />
    );
  };

  const imageProps = {
    customImages: state.customImages,
    usersOf: (key: string) => imageUsers(state, key),
    onAddImage,
    onUpdateImage,
    onDeleteImage,
    onClose: close,
  };

  const renderModal = () => {
    if (!modal) return null;
    if (modal.kind === 'group') {
      const group = GROUPS.find((g) => g.id === modal.group)!;
      return (
        <Modal title={group.title} onClose={close}>
          <p>{group.info}</p>
        </Modal>
      );
    }
    if (modal.kind === 'add') {
      const group = modal.group;
      return (
        <TaskFormDialog
          {...imageProps}
          title={NEW_TITLES[group]}
          group={group}
          today={today}
          onSubmit={(values) => {
            onAddTask({ group, ...values });
            close();
          }}
        />
      );
    }
    const task = findTask(state.tasks, modal.id);
    if (!task) return null;
    if (modal.kind === 'task') {
      return (
        <Modal title={task.name.toUpperCase()} onClose={close}>
          <p>{task.description || 'No description yet.'}</p>
        </Modal>
      );
    }
    return (
      <TaskFormDialog
        {...imageProps}
        title="EDIT TASK"
        group={taskGroup(task)}
        today={today}
        task={task}
        onSubmit={({ name, description, image }) => {
          onEditTask(task.id, { name, description, image });
          close();
        }}
        onRemove={() => {
          onRemoveTask(task.id);
          close();
        }}
        onUndoRemove={() => {
          onUndoRemove(task.id);
          close();
        }}
      />
    );
  };

  return (
    <>
      {GROUPS.map((group) => {
        const tasks = state.tasks.filter((task) => taskGroup(task) === group.id);
        return (
          <section key={group.id} className="task-group" aria-labelledby={`group-${group.id}`}>
            <div className="group-head">
              <h2 id={`group-${group.id}`} className="group-title">
                {group.title}
              </h2>
              <button
                type="button"
                className="btn info-btn"
                aria-label={`About ${group.title} tasks`}
                onClick={open({ kind: 'group', group: group.id })}
              >
                [?]
              </button>
            </div>
            <div className="grid">
              {tasks.map(renderCard)}
              <AddCard group={group.id} onClick={open({ kind: 'add', group: group.id })} />
            </div>
          </section>
        );
      })}
      {renderModal()}
    </>
  );
}
