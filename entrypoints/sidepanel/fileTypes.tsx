import { type JSX } from "solid-js";

export type FileKind =
  | "folder"
  | "pdf"
  | "doc"
  | "sheet"
  | "excel"
  | "slide"
  | "archive"
  | "image"
  | "text"
  | "file";

const exactMimeTypeToKind = new Map<string, FileKind>([
  ["application/vnd.google-apps.folder", "folder"],
  ["application/pdf", "pdf"],
  ["application/x-pdf", "pdf"],
  ["application/vnd.google-apps.document", "doc"],
  ["application/msword", "doc"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "doc",
  ],
  ["application/vnd.google-apps.spreadsheet", "sheet"],
  ["text/csv", "sheet"],
  ["application/vnd.ms-excel", "excel"],
  [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "excel",
  ],
  ["application/vnd.google-apps.presentation", "slide"],
  ["application/vnd.ms-powerpoint", "slide"],
  [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "slide",
  ],
  ["application/zip", "archive"],
  ["application/x-zip-compressed", "archive"],
  ["application/x-rar-compressed", "archive"],
]);

const mimeTypePrefixToKind = new Map<string, FileKind>([
  ["image/", "image"],
  ["text/", "text"],
]);

export function getFileKind(mimeType: string): FileKind {
  const exactKind = exactMimeTypeToKind.get(mimeType);
  if (exactKind) {
    return exactKind;
  }

  for (const [prefix, kind] of mimeTypePrefixToKind) {
    if (mimeType.startsWith(prefix)) {
      return kind;
    }
  }

  return "file";
}

const fileTypeIconByKind = new Map<FileKind, () => JSX.Element>([
  [
    "folder",
    () => (
      <svg
        class="drive-file-icon-folder"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M10,4H4C2.9,4,2.01,4.9,2.01,6L2,18c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2V8c0-1.1-0.9-2-2-2h-8L10,4z" />
      </svg>
    ),
  ],
  [
    "pdf",
    () => (
      <svg class="drive-file-icon" viewBox="0 0 16 16" aria-hidden="true">
        <path
          fill="#d93025"
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M1.778 0h12.444C15.2 0 16 .8 16 1.778v12.444C16 15.2 15.2 16 14.222 16H1.778C.8 16 0 15.2 0 14.222V1.778C0 .8.8 0 1.778 0zm2.666 7.556h-.888v-.89h.888v.89zm1.334 0c0 .737-.596 1.333-1.334 1.333h-.888v1.778H2.222V5.333h2.222c.738 0 1.334.596 1.334 1.334v.889zm6.666-.89h2.223V5.334H11.11v5.334h1.333V8.889h1.334V7.556h-1.334v-.89zm-2.222 2.667c0 .738-.595 1.334-1.333 1.334H6.667V5.333h2.222c.738 0 1.333.596 1.333 1.334v2.666zm-1.333 0H8V6.667h.889v2.666z"
        />
      </svg>
    ),
  ],
  [
    "doc",
    () => (
      <svg class="drive-file-icon" viewBox="0 0 16 16" aria-hidden="true">
        <path
          fill="#1a73e8"
          d="M14.222 0H1.778C.8 0 0 .8 0 1.778v12.444C0 15.2.8 16 1.778 16h12.444C15.2 16 16 15.2 16 14.222V1.778C16 .8 15.2 0 14.222 0zm-1.769 5.333H3.556V3.556h8.897v1.777zm0 3.556H3.556V7.11h8.897V8.89zm-2.666 3.555H3.556v-1.777h6.23v1.777z"
        />
      </svg>
    ),
  ],
  [
    "sheet",
    () => (
      <svg class="drive-file-icon" viewBox="0 0 16 16" aria-hidden="true">
        <path
          fill="#1e8e3e"
          d="M14.222 0H1.778C.8 0 .008.8.008 1.778L0 4.444v9.778C0 15.2.8 16 1.778 16h12.444C15.2 16 16 15.2 16 14.222V1.778C16 .8 15.2 0 14.222 0zm0 7.111h-7.11v7.111H5.332v-7.11H1.778V5.332h3.555V1.778h1.778v3.555h7.111v1.778z"
        />
      </svg>
    ),
  ],
  [
    "excel",
    () => (
      <svg class="drive-file-icon" viewBox="0 0 16 16" aria-hidden="true">
        <path
          fill="#188038"
          d="M14.222 0H1.778C.796 0 0 .796 0 1.778v12.444C0 15.204.796 16 1.778 16h12.444c.982 0 1.778-.796 1.778-1.778V1.778C16 .796 15.204 0 14.222 0zm-2.489 12.444H9.956L8 9.067l-1.956 3.377H4.267L7.11 8 4.267 3.556h1.777L8 6.933l1.956-3.377h1.777L8.89 8l2.844 4.444z"
        />
      </svg>
    ),
  ],
  [
    "slide",
    () => (
      <svg class="drive-file-icon" viewBox="0 0 16 16" aria-hidden="true">
        <path
          fill="#f29900"
          d="M1.778 0h12.444C15.2 0 16 .8 16 1.778v12.444C16 15.2 15.2 16 14.222 16H1.778C.8 16 0 15.2 0 14.222V1.778C0 .8.8 0 1.778 0zm2.666 10.667h2.223V8.89h2.222V7.556H6.667V5.333H4.444v5.334zm5.334 0h1.333V5.333H9.778v5.334z"
        />
      </svg>
    ),
  ],
  [
    "archive",
    () => (
      <svg class="drive-file-icon" viewBox="0 -960 960 960" aria-hidden="true">
        <path
          fill="#5f6368"
          d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm200-560h80v-80h-80v80Zm80 240h80v-80h-80v80Zm0-160h80v-80h-80v80Zm-80 80h80v-80h-80v80Zm0 160h80v-80h-80v80Zm80 80h80v-80h-80v80Z"
        />
      </svg>
    ),
  ],
  [
    "image",
    () => (
      <svg class="drive-file-icon" viewBox="0 0 16 16" aria-hidden="true">
        <path
          fill="#a142f4"
          d="M16 14.222V1.778C16 .796 15.204 0 14.222 0H1.778C.796 0 0 .796 0 1.778v12.444C0 15.204.796 16 1.778 16h12.444c.982 0 1.778-.796 1.778-1.778zM4.889 9.333l2.222 2.671L10.222 8l4 5.333H1.778l3.11-4z"
        />
      </svg>
    ),
  ],
  [
    "text",
    () => (
      <svg class="drive-file-icon" viewBox="-2 0 16 16" aria-hidden="true">
        <path
          fill="#5f6368"
          d="M8 0H1.6C.72 0 .008.72.008 1.6L0 14.4c0 .88.712 1.6 1.592 1.6H11.2c.88 0 1.6-.72 1.6-1.6V4.8L8 0zm1.6 12.8H3.2v-1.6h6.4v1.6zm0-3.2H3.2V8h6.4v1.6zm-2.4-4V1.2l4.4 4.4H7.2z"
        />
      </svg>
    ),
  ],
  [
    "file",
    () => (
      <svg class="drive-file-icon" viewBox="-2 0 16 16" aria-hidden="true">
        <path
          fill="#5f6368"
          d="M8 0H1.6C.72 0 .008.72.008 1.6L0 14.4c0 .88.712 1.6 1.592 1.6H11.2c.88 0 1.6-.72 1.6-1.6V4.8L8 0zm1.6 12.8H3.2v-1.6h6.4v1.6zm0-3.2H3.2V8h6.4v1.6zm-2.4-4V1.2l4.4 4.4H7.2z"
        />
      </svg>
    ),
  ],
]);

export function FileTypeIcon(props: { mimeType: string }): JSX.Element {
  const kind = getFileKind(props.mimeType);
  const renderIcon =
    fileTypeIconByKind.get(kind) ?? fileTypeIconByKind.get("file");

  return renderIcon ? renderIcon() : <></>;
}
