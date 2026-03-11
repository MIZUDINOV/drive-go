import { createSignal, onCleanup, onMount, Show } from "solid-js";

type DragDropOverlayProps = {
  onDrop: (files: File[]) => void;
};

export function DragDropOverlay(props: DragDropOverlayProps) {
  const [isDragging, setIsDragging] = createSignal(false);
  let dragCounter = 0;

  const handleDragEnter = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    dragCounter++;

    if (event.dataTransfer?.types.includes("Files")) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    dragCounter--;

    if (dragCounter === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    dragCounter = 0;
    setIsDragging(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      props.onDrop(fileArray);
    }
  };

  onMount(() => {
    // Добавляем глобальные обработчики только после монтирования компонента.
    document.addEventListener("dragenter", handleDragEnter);
    document.addEventListener("dragleave", handleDragLeave);
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("drop", handleDrop);
  });

  onCleanup(() => {
    document.removeEventListener("dragenter", handleDragEnter);
    document.removeEventListener("dragleave", handleDragLeave);
    document.removeEventListener("dragover", handleDragOver);
    document.removeEventListener("drop", handleDrop);
  });

  return (
    <Show when={isDragging()}>
      <div class="drag-drop-overlay">
        <div class="drag-drop-content">
          <svg
            class="drag-drop-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M4 17h16v2H4z" fill="currentColor" />
            <path
              d="M12 4v9m0 0-3.5-3.5M12 13l3.5-3.5"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
          <h2 class="drag-drop-title">Перетащите файлы сюда</h2>
          <p class="drag-drop-subtitle">Файлы будут загружены в текущую папку</p>
        </div>
      </div>
    </Show>
  );
}
