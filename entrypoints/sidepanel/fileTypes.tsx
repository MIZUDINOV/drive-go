import { type JSX } from "solid-js";

export type FileKind =
  | "folder"
  | "pdf"
  | "doc"
  | "sheet"
  | "excel"
  | "slide"
  | "form"
  | "archive"
  | "audio"
  | "video"
  | "vids"
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
  ["application/vnd.google-apps.form", "form"],
  ["application/zip", "archive"],
  ["application/x-zip-compressed", "archive"],
  ["application/x-rar-compressed", "archive"],
  ["application/x-7z-compressed", "archive"],
  ["application/x-tar", "archive"],
  ["application/gzip", "archive"],
  ["application/vnd.google-apps.vid", "vids"],
  ["application/vnd.google-apps.video", "video"],
]);

const mimeTypePrefixToKind = new Map<string, FileKind>([
  ["image/", "image"],
  ["audio/", "audio"],
  ["video/", "video"],
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
          d="M14.213 0H1.77C.79 0 0 .8 0 1.778v12.444C0 15.2.791 16 1.769 16h12.444c.978 0 1.778-.8 1.778-1.778V1.778C15.991.8 15.191 0 14.213 0zm0 11.556H1.77V4.444h12.444v7.112z"
        />
      </svg>
    ),
  ],
  [
    "form",
    () => (
      <svg
        class="drive-file-icon drive-file-icon-new-format drive-file-icon-form"
        viewBox="0 0 16 16"
        aria-hidden="true"
      >
        <path
          fill="#7b1fa2"
          d="M14.222 0H1.778C.8 0 0 .8 0 1.778v12.444C0 15.2.8 16 1.778 16h12.444C15.2 16 16 15.2 16 14.222V1.778C16 .8 15.2 0 14.222 0zM5.333 12.444H3.556v-1.777h1.777v1.777zm0-3.555H3.556V7.11h1.777V8.89zm0-3.556H3.556V3.556h1.777v1.777zm7.111 7.111H6.222v-1.777h6.222v1.777zm0-3.555H6.222V7.11h6.222V8.89zm0-3.556H6.222V3.556h6.222v1.777z"
        />
      </svg>
    ),
  ],
  [
    "archive",
    () => (
      <svg
        class="drive-file-icon drive-file-icon-new-format drive-file-icon-archive"
        viewBox="3 3 18 18"
        aria-hidden="true"
      >
        <path d="M0 0h24v24H0z" fill="none" />
        <path
          fill="#5f6368"
          d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 15l-4-4h8l-4 4zm4-6H8v-2h8v2zm0-4H8V6h8v2z"
        />
      </svg>
    ),
  ],
  [
    "audio",
    () => (
      <svg
        class="drive-file-icon drive-file-icon-new-format drive-file-icon-audio"
        viewBox="3 3 18 18"
        aria-hidden="true"
      >
        <path
          fill="#d93025"
          d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7.2 18c-.66 0-1.2-.54-1.2-1.2V12c0-3.31 2.69-6 6-6s6 2.69 6 6v4.8c0 .66-.54 1.2-1.2 1.2H14v-4h2v-2c0-2.21-1.79-4-4-4s-4 1.79-4 4v2h2v4H7.2z"
        />
        <path d="M0 0h24v24H0z" fill="none" />
      </svg>
    ),
  ],
  [
    "video",
    () => (
      <svg
        class="drive-file-icon drive-file-icon-new-format drive-file-icon-video"
        viewBox="0 -2 16 16"
        aria-hidden="true"
      >
        <path
          fill="#d93025"
          d="M12.8 0l1.6 3.2H12L10.4 0H8.8l1.6 3.2H8L6.4 0H4.8l1.6 3.2H4L2.4 0h-.8C.72 0 .008.72.008 1.6L0 11.2c0 .88.72 1.6 1.6 1.6h12.8c.88 0 1.6-.72 1.6-1.6V0h-3.2z"
        />
      </svg>
    ),
  ],
  [
    "vids",
    () => (
      <svg
        class="drive-file-icon drive-file-icon-new-format drive-file-icon-vids"
        viewBox="0 0 16 16"
        aria-hidden="true"
      >
        <path fill="#1a73e8" d="M5.778 5.803v4.392L9.333 8 5.778 5.803z" />
        <path
          fill="#1a73e8"
          d="M14.222 0H1.778C.798 0 0 .798 0 1.778v12.444C0 15.202.798 16 1.778 16h12.444c.98 0 1.778-.798 1.778-1.778V1.778C16 .798 15.202 0 14.222 0ZM4 13.333V2.667L12.889 8 4 13.333Z"
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
