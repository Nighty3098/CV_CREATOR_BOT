export function generateOrderId(): string {
  return Math.random().toString(36).substr(2, 9).toUpperCase();
}

export function isValidResumeFile(filename: string): boolean {
  return /\.(docx?|pdf)$/i.test(filename);
}

export function isValidImageFile(filename: string): boolean {
  return /\.(jpe?g|png)$/i.test(filename);
}

export function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export function isCommand(text: string) {
  return text.startsWith('/');
}

export function isEmptyText(text: string) {
  return !text.trim();
}

export function isTooLongText(text: string, max = 4096) {
  return text.length > max;
}

export function isFileTooLarge(fileSize: number, maxMB = 20) {
  return fileSize > maxMB * 1024 * 1024;
}

export function isSkipButton(text: string) {
  return text === 'Пропустить';
} 
