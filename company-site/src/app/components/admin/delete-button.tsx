"use client";

interface DeleteButtonProps {
  action: () => Promise<void>;
  confirmMessage: string;
  buttonText?: string;
  className?: string;
}

export function DeleteButton({
  action,
  confirmMessage,
  buttonText = "Delete",
  className = "bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700",
}: DeleteButtonProps) {
  async function handleSubmit() {
    if (confirm(confirmMessage)) {
      await action();
    }
  }

  return (
    <form action={handleSubmit}>
      <button type="submit" className={className}>
        {buttonText}
      </button>
    </form>
  );
}

interface DeleteLinkButtonProps {
  action: (formData: FormData) => Promise<void>;
  confirmMessage: string;
  buttonText?: string;
  hiddenInputs?: Record<string, string>;
}

export function DeleteLinkButton({
  action,
  confirmMessage,
  buttonText = "Delete",
  hiddenInputs = {},
}: DeleteLinkButtonProps) {
  async function handleSubmit(formData: FormData) {
    if (confirm(confirmMessage)) {
      await action(formData);
    }
  }

  return (
    <form action={handleSubmit}>
      {Object.entries(hiddenInputs).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" className="text-red-600 hover:underline text-sm">
        {buttonText}
      </button>
    </form>
  );
}
