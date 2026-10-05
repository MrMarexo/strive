import { useState } from 'react';
import { dayOfWeek, type DateKey } from '../domain/dates';
import { IMAGE_KEYS } from '../domain/imageKeys';
import { MAX_DESCRIPTION, MAX_TASK_NAME, TARGET_LIMITS, taskStatus, type TaskDef, type TaskGroup } from '../domain/tasks';
import { IMAGE_LIBRARY } from './images';
import { PixelSprite } from './PixelSprite';

export interface TaskFormValues {
  name: string;
  description: string;
  image: string;
  target: number;
}

interface TaskFormProps {
  group: TaskGroup;
  today: DateKey;
  task?: TaskDef; // present when editing
  onSubmit: (values: TaskFormValues) => void;
  onRemove?: () => void;
  onUndoRemove?: () => void;
}

export function TaskForm({ group, today, task, onSubmit, onRemove, onUndoRemove }: TaskFormProps) {
  const [name, setName] = useState(task?.name ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [image, setImage] = useState(task?.image ?? IMAGE_KEYS[0]);
  const [target, setTarget] = useState(task && task.cadence.kind === 'weekly' ? task.cadence.target : 3);
  const [confirming, setConfirming] = useState(false);

  const status = task ? taskStatus(task, today) : null;
  const maxTarget = group === 'weekly-unlimited' ? TARGET_LIMITS['weekly-unlimited'] : TARGET_LIMITS.weekly;
  const canSave = name.trim().length > 0;

  return (
    <form
      className="task-form"
      noValidate // out-of-range targets are clamped by addTask instead of blocked by the browser
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) onSubmit({ name, description, image, target });
      }}
    >
      <label className="field">
        <span>NAME</span>
        <input value={name} maxLength={MAX_TASK_NAME} onChange={(e) => setName(e.target.value)} />
      </label>

      {group !== 'daily' &&
        (task ? (
          <p className="field">
            <span>TARGET</span>
            {target} PER WEEK
          </p>
        ) : (
          <label className="field">
            <span>TARGET</span>
            <span className="target">
              <input
                type="number"
                min={1}
                max={maxTarget}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
              />{' '}
              PER WEEK
            </span>
          </label>
        ))}

      <fieldset className="field">
        <legend>IMAGE</legend>
        <div className="image-picker">
          {IMAGE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={key === image ? 'btn image-option selected' : 'btn image-option'}
              aria-label={key}
              aria-pressed={key === image}
              onClick={() => setImage(key)}
            >
              <PixelSprite map={IMAGE_LIBRARY[key]} size={30} className="option-sprite" />
            </button>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span>DESCRIPTION</span>
        <textarea
          value={description}
          maxLength={MAX_DESCRIPTION}
          rows={3}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      {!task && <p className="note">{dayOfWeek(today) === 0 ? 'STARTS TODAY' : 'STARTS NEXT MONDAY'}</p>}
      {confirming && (
        <p className="note">
          {status === 'pending' ? 'REMOVED NOW' : 'STAYS UNTIL SUNDAY NIGHT AND IS SCORED AS USUAL'}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="btn" disabled={!canSave}>
          [ SAVE ]
        </button>
        {task &&
          (status === 'retiring' ? (
            <button type="button" className="btn" onClick={onUndoRemove}>
              [ UNDO REMOVE ]
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => (confirming ? onRemove?.() : setConfirming(true))}>
              {confirming ? '[ CONFIRM REMOVE ]' : '[ REMOVE ]'}
            </button>
          ))}
      </div>
    </form>
  );
}
