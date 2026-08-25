#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const blogDir = path.join(root, "blog");
const excludeArg = process.argv.find((arg) => arg.startsWith("--exclude="));
const excluded = new Set(
  (excludeArg?.slice("--exclude=".length) ?? "")
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean),
);

const errors = [];
const fail = (slug, message) => errors.push(`${slug}: ${message}`);
const decode = (value) => value
  .replace(/&larr;/g, "←")
  .replace(/&rarr;/g, "→")
  .replace(/&middot;/g, "·")
  .replace(/&amp;/g, "&")
  .replace(/&#39;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/<[^>]+>/g, "")
  .replace(/\s+/g, " ")
  .trim();

const meta = (html, key) => {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(
    new RegExp(`<meta\\s+(?:name|property)="${escaped}"\\s+content="([^"]*)">`),
  );
  return match?.[1] ?? "";
};

const pngDimensions = (file) => {
  const data = fs.readFileSync(file);
  const signature = data.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a" || data.length < 24) return null;
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
};

const posts = fs.readdirSync(blogDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const slug = entry.name;
    const file = path.join(blogDir, slug, "index.html");
    if (!fs.existsSync(file)) return null;
    const html = fs.readFileSync(file, "utf8");
    const number = Number(html.match(/<span class="num">No\.\s*(\d+)<\/span>/)?.[1]);
    return { slug, file, html, number };
  })
  .filter(Boolean)
  .sort((a, b) => a.number - b.number);

const byNumber = new Map(posts.map((post) => [post.number, post]));
if (byNumber.size !== posts.length) {
  fail("blog", "post numbers must be present and unique");
}

for (const post of posts) {
  if (excluded.has(post.slug)) continue;
  const { slug, file, html, number } = post;
  const canonical = `https://kit-project.com/blog/${slug}/`;
  const published = meta(html, "article:published_time");
  const modified = meta(html, "article:modified_time");
  const title = meta(html, "og:title");
  const description = meta(html, "description");
  const ogDescription = meta(html, "og:description");
  const twitterDescription = meta(html, "twitter:description");

  if (!title) fail(slug, "missing og:title");
  if (meta(html, "og:type") !== "article") fail(slug, "og:type must be article");
  if (meta(html, "og:url") !== canonical) fail(slug, "og:url must match the canonical URL");
  if (meta(html, "og:site_name") !== "Kit Notes") fail(slug, "missing og:site_name");
  if (meta(html, "article:author") !== "Kit") fail(slug, "article:author must be Kit");
  if (!published || !/^\d{4}-\d{2}-\d{2}$/.test(published)) fail(slug, "invalid article:published_time");
  if (!modified || !/^\d{4}-\d{2}-\d{2}$/.test(modified)) fail(slug, "invalid article:modified_time");

  if (!description || description.length > 160) {
    fail(slug, `description must be 1 to 160 characters, found ${description.length}`);
  }
  if (description !== ogDescription || description !== twitterDescription) {
    fail(slug, "HTML, Open Graph, and X descriptions must match");
  }
  const sentenceMarks = description.match(/[.!?](?:\s|$)/g)?.length ?? 0;
  if (sentenceMarks !== 1) fail(slug, "description must be one complete sentence");

  const jsonText = html.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  let json;
  try {
    json = JSON.parse(jsonText ?? "");
  } catch {
    fail(slug, "JSON-LD must parse");
  }
  if (json) {
    if (json["@type"] !== "BlogPosting") fail(slug, "JSON-LD type must be BlogPosting");
    if (json.description !== description) fail(slug, "JSON-LD description must match social description");
    if (json.url !== canonical) fail(slug, "JSON-LD URL must match canonical URL");
    if (json.datePublished !== published) fail(slug, "JSON-LD datePublished must match article metadata");
    if (json.dateModified !== modified) fail(slug, "JSON-LD dateModified must match article metadata");
  }

  const time = html.match(/<time\s+datetime="([^"]+)"[^>]*>([\s\S]*?)<\/time>/);
  if (!time || time[1] !== published) fail(slug, "post header needs a time element matching the published date");

  const imageFile = path.join(path.dirname(file), "og-image.png");
  const hasImage = fs.existsSync(imageFile);
  const ogImage = meta(html, "og:image");
  const twitterImage = meta(html, "twitter:image");
  if (hasImage) {
    const expectedImage = `${canonical}og-image.png`;
    const dimensions = pngDimensions(imageFile);
    if (ogImage !== expectedImage || twitterImage !== expectedImage) {
      fail(slug, "social image URLs must point to the existing local og-image.png");
    }
    if (meta(html, "twitter:card") !== "summary_large_image") {
      fail(slug, "posts with an image need a summary_large_image card");
    }
    if (!meta(html, "og:image:alt") || !meta(html, "twitter:image:alt")) {
      fail(slug, "posts with an image need Open Graph and X image alt text");
    }
    if (meta(html, "og:image:type") !== "image/png") fail(slug, "og:image:type must be image/png");
    if (dimensions && (
      Number(meta(html, "og:image:width")) !== dimensions.width
      || Number(meta(html, "og:image:height")) !== dimensions.height
    )) {
      fail(slug, "social image dimensions must match the PNG");
    }
    if (json && json.image !== expectedImage) fail(slug, "JSON-LD image must match the existing PNG");
  } else {
    if (ogImage || twitterImage) fail(slug, "image metadata present without a local image");
    if (meta(html, "twitter:card") !== "summary") fail(slug, "posts without an image need a summary card");
    if (json && "image" in json) fail(slug, "JSON-LD must not invent an image");
  }

  const body = html.match(/<div class="post__body">([\s\S]*?)<\/div>\s*(?:<footer|<\/article>)/)?.[1] ?? "";
  const headings = [...body.matchAll(/<h2(?:\s+[^>]*)?>([\s\S]*?)<\/h2>/g)].map((match) => ({
    id: match[0].match(/\sid="([^"]+)"/)?.[1] ?? "",
    text: decode(match[1]),
  }));
  const headingIds = headings.map((heading) => heading.id);
  if (headingIds.some((id) => !id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))) {
    fail(slug, "every article h2 needs a stable kebab-case id");
  }
  if (new Set(headingIds).size !== headingIds.length) fail(slug, "article h2 ids must be unique");

  const toc = html.match(/<nav class="post__toc"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? "";
  if (headings.length >= 4) {
    if (!toc) {
      fail(slug, "posts with at least four h2 headings need a static table of contents");
    } else {
      const links = [...toc.matchAll(/<a\s+href="#([^"]+)">([\s\S]*?)<\/a>/g)].map((match) => ({
        id: match[1],
        text: decode(match[2]),
      }));
      if (JSON.stringify(links) !== JSON.stringify(headings)) {
        fail(slug, "table of contents links must match article h2 headings in order");
      }
    }
  }

  const footer = html.match(/<footer class="post__footer">([\s\S]*?)<\/footer>/)?.[1] ?? "";
  const pager = footer.match(/<nav class="post__pager"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? "";
  if (!pager) {
    fail(slug, "missing post pager");
  } else {
    const links = [...pager.matchAll(/<a\s+href="([^"]+)">([\s\S]*?)<\/a>/g)].map((match) => ({
      href: match[1],
      text: decode(match[2]),
    }));
    if (!links.some((link) => link.href === "/blog/" && link.text === "All notes")) {
      fail(slug, "pager must include an All notes link");
    }
    const older = byNumber.get(number - 1);
    const newer = byNumber.get(number + 1);
    if (older && !links.some((link) => link.href === `/blog/${older.slug}/` && link.text.startsWith("← Older:"))) {
      fail(slug, `pager must link to older note No. ${String(number - 1).padStart(3, "0")}`);
    }
    if (newer && !links.some((link) => link.href === `/blog/${newer.slug}/` && link.text.startsWith("Newer:") && link.text.endsWith("→"))) {
      fail(slug, `pager must link to newer note No. ${String(number + 1).padStart(3, "0")}`);
    }
  }
}

if (errors.length) {
  console.error(`Blog validation failed with ${errors.length} issue${errors.length === 1 ? "" : "s"}:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  const checked = posts.length - posts.filter((post) => excluded.has(post.slug)).length;
  console.log(`Validated ${checked} blog post${checked === 1 ? "" : "s"}.`);
}
