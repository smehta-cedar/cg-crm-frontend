"use client";

import { useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import type {
  ModuleOption,
  PermissionAction,
  PermissionFlags,
  RoleError,
  RolePermissions,
  RoleRecord,
  RoleValues,
} from "@/lib/roles";

/*
 * The one Add / Edit role dialog: name, status, description and a grid of
 * sidebar links by action. Each row's switch turns every action on or off;
 * it shows on when all four are. Checking create, update, delete or View all
 * also checks view; unchecking view clears the row. A header checkbox sets a
 * whole column. Every role, Agent included, lists the sidebar links and
 * follows the same rules.
 *
 * View all shows only on links whose records belong to someone (`ownable`).
 * Left off, the boxes reach only the user's own records there: under their
 * agent profile, or ones they made.
 *
 * The view passes `onSave` and `onDelete`, which call the server actions
 * (./actions.ts) and update its own state. Delete asks once more inside the
 * dialog before it runs; the API refuses it while any user holds the role.
 * A built-in role (Admin, Operations, Agent, SDR) keeps its name and stays active,
 * and has no Delete. While a save or delete is in flight the buttons are
 * disabled.
 */

/** Which dialog is open. Edit holds the role as it was when the dialog opened. */
export type RoleEditor = { mode: "add" } | { mode: "edit"; role: RoleRecord };

export type { RoleError, RoleValues } from "@/lib/roles";

/** Column order in the grid; also the order the API stores them in. */
export const PERMISSION_ACTIONS: PermissionAction[] = ["view", "create", "update", "delete"];

/** A box in a row: an action, or View all. */
type Flag = keyof PermissionFlags;

/** Every column of boxes, View all last. */
const FLAGS: Flag[] = [...PERMISSION_ACTIONS, "all"];

/** What each box is called in the grid. */
const FLAG_LABELS: Record<Flag, string> = {
  view: "Read",
  create: "Add",
  update: "Edit",
  delete: "Delete",
  all: "View all",
};

/** A built-in role's name and status, shown but not editable. */
const LOCKED_CLASS = "cursor-not-allowed bg-surface-muted text-fg-muted";

const NO_ACCESS: PermissionFlags = { view: false, create: false, update: false, delete: false, all: false };

/** The built-in role every agent sign-in uses. */
export const isAgentRole = (role: RoleRecord) => role.builtIn && role.name.toLowerCase() === "agent";

/** Whether the row has this box: View all only where records belong to someone. */
const hasFlag = (module: ModuleOption, flag: Flag) => flag !== "all" || module.ownable;

type RoleDialogProps = {
  /** Null keeps the dialog closed. */
  editor: RoleEditor | null;
  /** Every module a role can be granted, in menu order. */
  modules: ModuleOption[];
  /** Saves the values; resolves with the error to show instead of closing. */
  onSave: (values: RoleValues) => Promise<RoleError | null>;
  /** Deletes the role being edited; resolves with the error to show instead of closing. */
  onDelete: (role: RoleRecord) => Promise<RoleError | null>;
  /** Runs for every close: Cancel, a save or a delete. */
  onClose: () => void;
};

export function RoleDialog({ editor, modules, onSave, onDelete, onClose }: RoleDialogProps) {
  const { dialogRef, close } = useModalDialog(editor !== null);
  const id = useId();

  // Clearing the editor unmounts the form, which resets it.
  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {editor ? (
        <RoleForm id={id} editor={editor} modules={modules} onSave={onSave} onDelete={onDelete} close={close} />
      ) : null}
    </ModalDialog>
  );
}

type RoleFormProps = Pick<RoleDialogProps, "onSave" | "onDelete" | "modules"> & {
  id: string;
  editor: RoleEditor;
  close: () => void;
};

/** Every module with the flags the role holds, or none. */
function initialPermissions(modules: ModuleOption[], role?: RoleRecord): RolePermissions {
  const permissions: RolePermissions = {};
  for (const module of modules) permissions[module.code] = { ...NO_ACCESS, ...role?.permissions[module.code] };
  return permissions;
}

/** The dialog's form. Mounted per open, so its errors start clear each time. */
function RoleForm({ id, editor, modules, onSave, onDelete, close }: RoleFormProps) {
  const editing = editor.mode === "edit" ? editor.role : undefined;
  const builtIn = editing?.builtIn ?? false;
  const [permissions, setPermissions] = useState(() => initialPermissions(modules, editing));
  const [error, setError] = useState<RoleError | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const messageFor = (field: RoleError["field"]) => (error?.field === field ? error.message : null);
  const clear = () => setError(null);

  const nameError = messageFor("name");
  const descriptionError = messageFor("description");
  const permissionsError = messageFor("permissions");
  const formError = messageFor("form") ?? messageFor("status");

  /** `flags` with one box set, keeping the rule that every other box needs view. */
  const withFlag = (flags: PermissionFlags, flag: Flag, checked: boolean): PermissionFlags => {
    if (flag === "view" && !checked) return { ...NO_ACCESS };
    return { ...flags, [flag]: checked, ...(checked ? { view: true } : {}) };
  };

  const setFlag = (module: ModuleOption, flag: Flag, checked: boolean) => {
    clear();
    setPermissions((current) => ({ ...current, [module.code]: withFlag(current[module.code], flag, checked) }));
  };

  /** The row's switch: every action on (View all left as it was), or nothing. */
  const setRow = (module: ModuleOption, on: boolean) => {
    clear();
    setPermissions((current) => ({
      ...current,
      [module.code]: on
        ? { view: true, create: true, update: true, delete: true, all: current[module.code].all }
        : { ...NO_ACCESS },
    }));
  };

  /** On when all four actions are checked. */
  const rowOn = (module: ModuleOption) => PERMISSION_ACTIONS.every((action) => permissions[module.code]?.[action]);

  /** Sets one box on every row that has it, with the same view rule. */
  const setColumn = (flag: Flag, checked: boolean) => {
    clear();
    setPermissions((current) => {
      const next: RolePermissions = { ...current };
      for (const module of modules) {
        if (hasFlag(module, flag)) next[module.code] = withFlag(current[module.code], flag, checked);
      }
      return next;
    });
  };

  const columnChecked = (flag: Flag) => {
    const open = modules.filter((module) => hasFlag(module, flag));
    return open.length > 0 && open.every((module) => permissions[module.code]?.[flag]);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const text = (field: string) => String(data.get(field) ?? "").trim();
    const values: RoleValues = {
      name: text("name"),
      description: text("description"),
      status: text("status") === "inactive" ? "inactive" : "active",
      permissions,
    };
    setBusy(true);
    try {
      const saveError = await onSave(values);
      if (saveError) {
        setError(saveError);
        return;
      }
      close();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    const deleteError = await onDelete(editing);
    if (deleteError) {
      setError(deleteError);
      return;
    }
    close();
  };

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        {editing ? `Edit ${editing.name}` : "Add role"}
      </h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={`${id}-name`} hint={nameError ?? undefined} hintId={`${id}-name-error`} error>
          <input
            id={`${id}-name`}
            name="name"
            type="text"
            required
            pattern=".*\S.*"
            maxLength={100}
            autoComplete="off"
            defaultValue={editing?.name}
            readOnly={builtIn}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${id}-name-error` : undefined}
            onChange={clear}
            className={builtIn ? `${INPUT_CLASS} ${LOCKED_CLASS}` : INPUT_CLASS}
          />
        </Field>
        <Field label="Status" htmlFor={`${id}-status`}>
          <select
            id={`${id}-status`}
            name="status"
            defaultValue={editing?.status ?? "active"}
            // Disabled sends no status, which saves as active.
            disabled={builtIn}
            onChange={clear}
            className={builtIn ? `${INPUT_CLASS} ${LOCKED_CLASS}` : INPUT_CLASS}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
        <Field
          label="Description"
          optional
          htmlFor={`${id}-description`}
          hint={descriptionError ?? undefined}
          hintId={`${id}-description-error`}
          error
          className="sm:col-span-2"
        >
          <textarea
            id={`${id}-description`}
            name="description"
            rows={2}
            autoComplete="off"
            defaultValue={editing?.description}
            aria-invalid={descriptionError ? true : undefined}
            aria-describedby={descriptionError ? `${id}-description-error` : undefined}
            onChange={clear}
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-fg">Permissions</legend>
        <div className="mt-2 overflow-x-auto rounded-md border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-xs text-fg-subtle">
              <tr>
                <th scope="col" className="w-14 px-3 py-2 text-left font-medium">
                  <span className="sr-only">All</span>
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Module
                </th>
                {FLAGS.map((flag) => (
                  <th key={flag} scope="col" className="w-24 px-2 py-2 text-center font-medium">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={columnChecked(flag)}
                        onChange={(event) => setColumn(flag, event.currentTarget.checked)}
                        className="size-4 rounded border-line-strong accent-brand-strong"
                      />
                      {FLAG_LABELS[flag]}
                      <span className="sr-only"> for every module</span>
                    </label>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map((module) => (
                <tr key={module.code} className="border-t border-line">
                  <td className="px-3 py-2">
                    <Switch
                      checked={rowOn(module)}
                      label={`All permissions for ${module.label}`}
                      onChange={(on) => setRow(module, on)}
                    />
                  </td>
                  <th scope="row" className="px-3 py-2 text-left font-normal text-fg">
                    {module.label}
                  </th>
                  {FLAGS.map((flag) => (
                    <td key={flag} className="px-2 py-2 text-center">
                      {hasFlag(module, flag) ? (
                        <input
                          type="checkbox"
                          aria-label={`${FLAG_LABELS[flag]} ${module.label}`}
                          checked={permissions[module.code]?.[flag] ?? false}
                          onChange={(event) => setFlag(module, flag, event.currentTarget.checked)}
                          className="size-4 rounded border-line-strong accent-brand-strong"
                        />
                      ) : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {permissionsError ? <p className="mt-1 text-xs text-danger">{permissionsError}</p> : null}
      </fieldset>

      {/* Errors about the attempt itself (not a superuser, users still hold the role, API down), not one field. */}
      <div role="alert" className="mt-4">
        {formError ? <p className="text-sm text-danger">{formError}</p> : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          {editing && !builtIn ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
              className={`${GHOST_BUTTON_CLASS} text-danger hover:text-danger`}
            >
              Delete role
            </button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={close} disabled={busy} className={GHOST_BUTTON_CLASS}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-60`}>
            {busy ? "Saving…" : editing ? "Save changes" : "Add role"}
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmingDelete}
        title="Delete role"
        message={editing ? `Delete the ${editing.name} role?` : ""}
        onConfirm={handleDelete}
        onClose={() => setConfirmingDelete(false)}
      />
    </form>
  );
}

/** An on/off slider; on is the brand colour. */
function Switch({
  checked,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? "bg-brand-strong" : "bg-line-strong"
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block size-4 rounded-full bg-surface shadow transition-transform ${
          checked ? "translate-x-4.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
