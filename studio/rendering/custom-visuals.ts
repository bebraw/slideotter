export function isSafeInlineCustomVisualContent(value: unknown): boolean {
  const source = String(value || "").trim();
  if (!source || !/^<svg[\s>]/i.test(source)) {
    return false;
  }

  if (/<!doctype|<!entity|<\?|<!--|<script|<style|<foreignobject|<animate|<set|<iframe|<object|<embed|<form|<image/i.test(source)) {
    return false;
  }

  if (/\son[a-z]+\s*=|\sstyle\s*=|\s(?:href|xlink:href)\s*=/i.test(source)) {
    return false;
  }

  const sourceWithoutSvgNamespace = source.replace(/\sxmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/gi, "");
  if (/javascript:|data:|https?:/i.test(sourceWithoutSvgNamespace)) {
    return false;
  }

  return !/url\(\s*(?!#[a-zA-Z][a-zA-Z0-9_-]*\s*\))/i.test(sourceWithoutSvgNamespace);
}
