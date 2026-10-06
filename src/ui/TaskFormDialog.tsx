import { useEffect, useRef, useState } from 'react';
import type { DateKey } from '../domain/dates';
import { IMAGE_KEYS } from '../domain/imageKeys';
import type { CustomImage } from '../domain/images';
import type { TaskDef, TaskGroup } from '../domain/tasks';
import { IMAGE_LIBRARY } from './images';
import { Modal } from './Modal';
import { PixelEditor } from './PixelEditor';
import { TaskForm, type TaskFormValues } from './TaskForm';

interface TaskFormDialogProps {
  title: string;
  group: TaskGroup;
  today: DateKey;
  task?: TaskDef;
  customImages: CustomImage[];
  usersOf: (key: string) => string[];
  onSubmit: (values: TaskFormValues) => void;
  onRemove?: () => void;
  onUndoRemove?: () => void;
  onAddImage: (map: string[]) => string;
  onUpdateImage: (key: string, map: string[]) => void;
  onDeleteImage: (key: string) => void;
  onClose: () => void;
}

export function TaskFormDialog({
  title, group, today, task, customImages, usersOf, onSubmit, onRemove, onUndoRemove,
  onAddImage, onUpdateImage, onDeleteImage, onClose,
}: TaskFormDialogProps) {
  const [image, setImage] = useState(task?.image ?? IMAGE_KEYS[0]);
  const [editor, setEditor] = useState<{ key?: string } | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const backToForm = () => setEditor(null);
  const openEditor = (next: { key?: string }) => {
    opener.current = document.activeElement as HTMLElement | null;
    setEditor(next);
  };

  // Back on the form: return focus to the button that opened the editor, or to the
  // selected tile if that button is gone (e.g. after deleting the image).
  useEffect(() => {
    if (editor !== null || !opener.current) return;
    const target = opener.current.isConnected
      ? opener.current
      : formRef.current?.querySelector<HTMLElement>('.image-option.selected');
    opener.current = null;
    target?.focus();
  }, [editor]);
  const editing = editor?.key ? customImages.find((custom) => custom.key === editor.key) : undefined;
  const sources = [
    ...IMAGE_KEYS.map((key) => ({ key, label: key, map: IMAGE_LIBRARY[key] })),
    ...customImages.map((custom, i) => ({ key: custom.key, label: `custom image ${i + 1}`, map: custom.map })),
  ];

  return (
    <Modal title={editor ? (editor.key ? 'EDIT IMAGE' : 'NEW IMAGE') : title} onClose={editor ? backToForm : onClose}>
      {/* Hidden, not unmounted, so typed values survive a trip to the editor. */}
      <div ref={formRef} hidden={editor !== null}>
        <TaskForm
          group={group}
          today={today}
          task={task}
          image={image}
          onImageChange={setImage}
          customImages={customImages}
          onDraw={() => openEditor({})}
          onEditImage={(key) => openEditor({ key })}
          onSubmit={onSubmit}
          onRemove={onRemove}
          onUndoRemove={onUndoRemove}
        />
      </div>
      {editor && (
        <PixelEditor
          key={editor.key ?? 'new'}
          initial={editing?.map}
          images={sources}
          usedBy={editor.key ? usersOf(editor.key) : undefined}
          onSave={(map) => {
            if (editor.key) onUpdateImage(editor.key, map);
            else setImage(onAddImage(map));
            backToForm();
          }}
          onCancel={backToForm}
          onDelete={
            editor.key
              ? () => {
                  onDeleteImage(editor.key!);
                  if (image === editor.key) setImage(IMAGE_KEYS[0]);
                  backToForm();
                }
              : undefined
          }
        />
      )}
    </Modal>
  );
}
