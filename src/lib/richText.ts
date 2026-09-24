// For fields that used to be plain text (real "\n" line breaks) before
// becoming RichTextEditor fields — a value that's already HTML (anything
// saved after the field became rich text) is left untouched, so this only
// helps the one-time transition for older plain-text values loaded into the
// editor (editing an existing record, or an AI-parsed/generated plain-text
// result being dropped into the field).
export function plainTextToHtml(text: string): string {
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}
