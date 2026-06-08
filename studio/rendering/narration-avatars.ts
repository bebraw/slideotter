import { escapeHtml } from "./html.ts";

type AllowedUse = "allowed";

type NarrationAvatarLicense = {
  attribution: string;
  author: string;
  commercialUse: AllowedUse;
  license: string;
  licenseUrl: string;
  modification: AllowedUse;
  performance: AllowedUse;
  rawAssetRedistribution: AllowedUse;
  redistribution: AllowedUse;
  sourceUrl: string;
};

type NarrationAvatar = NarrationAvatarLicense & {
  description: string;
  id: string;
  label: string;
  palette: {
    accent: string;
    coat: string;
    hair: string;
    skin: string;
  };
};

const requiredLicenseFields: readonly (keyof NarrationAvatarLicense)[] = [
  "attribution",
  "author",
  "commercialUse",
  "license",
  "licenseUrl",
  "modification",
  "performance",
  "rawAssetRedistribution",
  "redistribution",
  "sourceUrl"
];

function assertAllowedUse(value: string, field: keyof NarrationAvatarLicense, id: string): void {
  if (value !== "allowed") {
    throw new Error(`Narration avatar "${id}" must allow ${field}.`);
  }
}

function assertNarrationAvatarLicense(avatar: NarrationAvatar): void {
  for (const field of requiredLicenseFields) {
    const value = String(avatar[field] || "").trim();
    if (!value) {
      throw new Error(`Narration avatar "${avatar.id}" is missing ${field}.`);
    }
  }

  assertAllowedUse(avatar.commercialUse, "commercialUse", avatar.id);
  assertAllowedUse(avatar.modification, "modification", avatar.id);
  assertAllowedUse(avatar.performance, "performance", avatar.id);
  assertAllowedUse(avatar.rawAssetRedistribution, "rawAssetRedistribution", avatar.id);
  assertAllowedUse(avatar.redistribution, "redistribution", avatar.id);
}

function defineNarrationAvatarCatalog(avatars: readonly NarrationAvatar[]): readonly NarrationAvatar[] {
  const seen = new Set<string>();
  for (const avatar of avatars) {
    if (seen.has(avatar.id)) {
      throw new Error(`Duplicate narration avatar id "${avatar.id}".`);
    }
    seen.add(avatar.id);
    assertNarrationAvatarLicense(avatar);
  }

  return avatars;
}

const bundledLicense = {
  author: "slideotter project",
  commercialUse: "allowed",
  license: "Project-owned bundled sample asset",
  licenseUrl: "repo://docs/adr/proposed/0060-licensed-narration-avatar-overlay.md",
  modification: "allowed",
  performance: "allowed",
  rawAssetRedistribution: "allowed",
  redistribution: "allowed",
  sourceUrl: "repo://studio/rendering/narration-avatars.ts"
} as const;

const bundledNarrationAvatars = defineNarrationAvatarCatalog([
  {
    ...bundledLicense,
    attribution: "Beacon presenter, original slideotter sample character",
    description: "A calm geometric presenter with a navy jacket and warm signal accent.",
    id: "beacon",
    label: "Beacon",
    palette: {
      accent: "#f4b941",
      coat: "#24445f",
      hair: "#1c2731",
      skin: "#f1c7a8"
    }
  },
  {
    ...bundledLicense,
    attribution: "Mica presenter, original slideotter sample character",
    description: "A bright editorial presenter with a green jacket and coral signal accent.",
    id: "mica",
    label: "Mica",
    palette: {
      accent: "#ef6f62",
      coat: "#2f6f5e",
      hair: "#463226",
      skin: "#f3c9b1"
    }
  }
] satisfies readonly NarrationAvatar[]);

function narrationAvatarById(id: string): NarrationAvatar {
  return bundledNarrationAvatars.find((avatar) => avatar.id === id) || bundledNarrationAvatars[0]!;
}

function renderNarrationAvatarOptions(): string {
  return [
    "<option value=\"none\">No avatar</option>",
    ...bundledNarrationAvatars.map((avatar) => (
      `<option value="${escapeHtml(avatar.id)}">${escapeHtml(avatar.label)}</option>`
    ))
  ].join("");
}

function renderNarrationAvatarOverlay(): string {
  return [
    "      <aside class=\"dom-presentation-avatar\" data-narration-avatar data-avatar-selected=\"none\" data-avatar-state=\"idle\" aria-label=\"Narration avatar\" hidden>",
    "        <div class=\"dom-presentation-avatar__stage\" aria-hidden=\"true\">",
    ...bundledNarrationAvatars.map((avatar) => [
      `          <div class="dom-presentation-avatar__figure" data-avatar-id="${escapeHtml(avatar.id)}" style="--avatar-skin: ${escapeHtml(avatar.palette.skin)}; --avatar-hair: ${escapeHtml(avatar.palette.hair)}; --avatar-coat: ${escapeHtml(avatar.palette.coat)}; --avatar-accent: ${escapeHtml(avatar.palette.accent)};">`,
      "            <span class=\"dom-presentation-avatar__signal\"></span>",
      "            <span class=\"dom-presentation-avatar__head\">",
      "              <span class=\"dom-presentation-avatar__hair\"></span>",
      "              <span class=\"dom-presentation-avatar__eye dom-presentation-avatar__eye--left\"></span>",
      "              <span class=\"dom-presentation-avatar__eye dom-presentation-avatar__eye--right\"></span>",
      "              <span class=\"dom-presentation-avatar__mouth\"></span>",
      "            </span>",
      "            <span class=\"dom-presentation-avatar__body\"></span>",
      "            <span class=\"dom-presentation-avatar__hand dom-presentation-avatar__hand--left\"></span>",
      "            <span class=\"dom-presentation-avatar__hand dom-presentation-avatar__hand--right\"></span>",
      "          </div>"
    ].join("\n")),
    "        </div>",
    "        <p class=\"dom-presentation-avatar__label\" data-narration-avatar-label></p>",
    "      </aside>"
  ].join("\n");
}

export {
  bundledNarrationAvatars,
  narrationAvatarById,
  renderNarrationAvatarOverlay,
  renderNarrationAvatarOptions,
  type NarrationAvatar
};
