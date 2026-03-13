import { createSignal, createEffect, createMemo, For, Show } from "solid-js";
import { Dialog } from "@kobalte/core/dialog";
import { Button } from "@kobalte/core/button";
import { TextField } from "@kobalte/core/text-field";
import { Select } from "@kobalte/core/select";
import type { DriveItem } from "./driveTypes";
import {
  listPermissions,
  addPermission,
  deletePermission,
  type DrivePermission,
  type PermissionRole,
} from "../../services/sharingApi";
import { openDriveItemInNewTab } from "../../services/driveApi";
import { useI18n } from "../../../shared/i18n";

type ShareDialogProps = {
  item: DriveItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type RoleOption = {
  value: PermissionRole;
  label: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ShareDialog(props: ShareDialogProps) {
  const { t } = useI18n();

  const roleOptions = createMemo<RoleOption[]>(() => [
    { value: "reader", label: t("drive.share.role.reader") },
    { value: "commenter", label: t("drive.share.role.commenter") },
    { value: "writer", label: t("drive.share.role.writer") },
  ]);

  const getRoleLabel = (role: string): string => {
    switch (role) {
      case "owner":
        return t("drive.share.role.owner");
      case "writer":
        return t("drive.share.role.writer");
      case "commenter":
        return t("drive.share.role.commenter");
      case "reader":
        return t("drive.share.role.reader");
      default:
        return role;
    }
  };

  const [permissions, setPermissions] = createSignal<DrivePermission[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [email, setEmail] = createSignal("");
  const [emailTouched, setEmailTouched] = createSignal(false);
  const [selectedRole, setSelectedRole] = createSignal<RoleOption>({
    value: "reader",
    label: "",
  });
  const [isAdding, setIsAdding] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const isEmailInvalid = () => {
    const value = email().trim();
    return emailTouched() && value.length > 0 && !EMAIL_RE.test(value);
  };

  createEffect(() => {
    if (props.open && props.item) {
      setError(null);
      setEmail("");
      setEmailTouched(false);
      setSelectedRole(roleOptions()[0]);
      void loadPermissions();
    }
  });

  const loadPermissions = async (): Promise<void> => {
    const item = props.item;
    if (!item) return;

    setIsLoading(true);
    const result = await listPermissions(item.id);
    setIsLoading(false);

    if (result.ok) {
      setPermissions(result.permissions);
    } else {
      setError(result.error);
    }
  };

  const handleAdd = async (): Promise<void> => {
    const item = props.item;
    const trimmedEmail = email().trim();
    if (!item || !trimmedEmail) return;

    setEmailTouched(true);

    if (!EMAIL_RE.test(trimmedEmail)) return;

    setError(null);
    setIsAdding(true);

    const result = await addPermission(
      item.id,
      trimmedEmail,
      selectedRole().value,
    );

    setIsAdding(false);

    if (result.ok) {
      setEmail("");
      void loadPermissions();
    } else {
      setError(result.error);
    }
  };

  const handleDelete = async (permissionId: string): Promise<void> => {
    const item = props.item;
    if (!item) return;

    setError(null);
    const result = await deletePermission(item.id, permissionId);

    if (result.ok) {
      setPermissions((prev) => prev.filter((p) => p.id !== permissionId));
    } else {
      setError(result.error);
    }
  };

  const handleOpenInDrive = (): void => {
    const item = props.item;
    if (!item) return;
    void openDriveItemInNewTab(item);
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="dialog-overlay" />
        <Dialog.Content class="dialog-content share-dialog-content">
          <Dialog.Title class="dialog-title">
            {t("drive.share.title", { name: props.item?.name ?? "" })}
          </Dialog.Title>

          <div class="dialog-body">
            <div class="share-add-row">
              <TextField
                value={email()}
                onChange={(val) => {
                  setEmail(val);
                  if (!emailTouched() && val.trim().length > 0) {
                    setEmailTouched(true);
                  }
                }}
                class="share-email-field"
                validationState={isEmailInvalid() ? "invalid" : "valid"}
              >
                <TextField.Input
                  class="folder-name-input"
                  type="email"
                  placeholder={t("drive.share.emailPlaceholder")}
                  autofocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && email().trim() && !isAdding()) {
                      void handleAdd();
                    }
                  }}
                />
                <TextField.ErrorMessage class="share-email-error">
                  {t("drive.share.emailError")}
                </TextField.ErrorMessage>
              </TextField>

              <Select<RoleOption>
                value={selectedRole()}
                onChange={(val) => {
                  if (val) setSelectedRole(val);
                }}
                options={roleOptions()}
                optionValue="value"
                optionTextValue="label"
                itemComponent={(itemProps) => (
                  <Select.Item item={itemProps.item} class="share-role-option">
                    <Select.ItemLabel>
                      {itemProps.item.rawValue.label}
                    </Select.ItemLabel>
                  </Select.Item>
                )}
              >
                <Select.Trigger class="share-role-trigger">
                  <Select.Value<RoleOption>>
                    {(state) => state.selectedOption()?.label}
                  </Select.Value>
                  <Select.Icon class="share-role-icon">
                    <span class="material-symbols-rounded">expand_more</span>
                  </Select.Icon>
                </Select.Trigger>
                <Select.Content class="share-role-content">
                  <Select.Listbox class="share-role-listbox" />
                </Select.Content>
              </Select>

              <Button
                class="dialog-btn dialog-btn-create share-add-btn"
                onClick={() => void handleAdd()}
                disabled={!email().trim() || isEmailInvalid() || isAdding()}
              >
                <span class="material-symbols-rounded">person_add</span>
              </Button>
            </div>

            <Show when={error()}>
              <div class="dialog-error">{error()}</div>
            </Show>

            <div class="share-permissions-section">
              <div class="share-permissions-title">
                {t("drive.share.whoHasAccess")}
              </div>

              <Show
                when={!isLoading()}
                fallback={
                  <div class="share-loading">
                    {t("drive.share.loadingPermissions")}
                  </div>
                }
              >
                <div class="share-permissions-list">
                  <For each={permissions()}>
                    {(perm) => (
                      <div class="share-permission-item">
                        <span class="material-symbols-rounded share-permission-avatar">
                          person
                        </span>
                        <div class="share-permission-info">
                          <span class="share-permission-name">
                            {perm.displayName ?? perm.emailAddress ?? perm.type}
                          </span>
                          <span class="share-permission-role">
                            {getRoleLabel(perm.role)}
                          </span>
                        </div>
                        <Show when={perm.role !== "owner"}>
                          <Button
                            class="share-permission-remove"
                            onClick={() => void handleDelete(perm.id)}
                            aria-label={t("drive.share.removeAccess")}
                          >
                            <span class="material-symbols-rounded">close</span>
                          </Button>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>

            <Button
              class="share-drive-link"
              onClick={handleOpenInDrive}
              type="button"
            >
              <span class="material-symbols-rounded">open_in_new</span>
              {t("drive.share.openInDrive")}
            </Button>
          </div>

          <div class="dialog-footer">
            <Button
              class="dialog-btn dialog-btn-create"
              onClick={() => props.onOpenChange(false)}
            >
              {t("drive.share.done")}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
