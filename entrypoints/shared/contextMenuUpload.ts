export const CONTEXT_MENU_ROOT_ID = "gdrivego.root";
export const CONTEXT_MENU_SCREENSHOT_ID = "gdrivego.screenshot";
export const CONTEXT_MENU_SELECTION_TEXT_ID = "gdrivego.selection-text";
export const CONTEXT_MENU_PDF_ID = "gdrivego.page-pdf";
export const CONTEXT_MENU_IMAGE_ID = "gdrivego.image";

export const MESSAGE_ENQUEUE_UPLOAD = "gdrivego.enqueue-upload";

export type UploadBridgeMessage = {
  type: typeof MESSAGE_ENQUEUE_UPLOAD;
  payload: {
    parentId: string | null;
    name: string;
    mimeType: string;
    base64: string;
  };
};
