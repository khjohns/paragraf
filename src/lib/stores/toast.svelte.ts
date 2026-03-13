class ToastState {
  toasts = $state<Array<{ id: string; message: string; type: 'info' | 'success' | 'error' }>>([]);

  show(message: string, type: 'info' | 'success' | 'error' = 'info') {
    const id = crypto.randomUUID();
    this.toasts.push({ id, message, type });
    setTimeout(() => this.dismiss(id), 3000);
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }
}

export const toastState = new ToastState();
