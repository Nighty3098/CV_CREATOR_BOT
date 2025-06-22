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
