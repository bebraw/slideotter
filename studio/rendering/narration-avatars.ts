import { escapeHtml } from "./escape.ts";

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
  art: "beacon" | "mica";
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
    art: "beacon",
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
    art: "mica",
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

function renderBeaconAvatarSvg(): string {
  return [
    "            <svg class=\"dom-presentation-avatar__svg\" viewBox=\"0 0 138 164\" role=\"img\" aria-label=\"\">",
    "              <ellipse class=\"dom-presentation-avatar__shadow\" cx=\"69\" cy=\"154\" rx=\"44\" ry=\"7\"></ellipse>",
    "              <circle class=\"dom-presentation-avatar__signal\" cx=\"111\" cy=\"20\" r=\"14\"></circle>",
    "              <circle class=\"dom-presentation-avatar__signal-dot\" cx=\"111\" cy=\"15\" r=\"2\"></circle>",
    "              <circle class=\"dom-presentation-avatar__signal-dot\" cx=\"111\" cy=\"24\" r=\"2\"></circle>",
    "              <path class=\"dom-presentation-avatar__body dom-presentation-avatar__body--beacon\" d=\"M23 156V118C23 98 41 86 69 86C97 86 115 98 115 118V156Z\"></path>",
    "              <path class=\"dom-presentation-avatar__shirt\" d=\"M54 91H84L76 118H62Z\"></path>",
    "              <path class=\"dom-presentation-avatar__tie\" d=\"M65 93H73L76 118L69 130L62 118Z\"></path>",
    "              <ellipse class=\"dom-presentation-avatar__hand dom-presentation-avatar__hand--left\" cx=\"27\" cy=\"124\" rx=\"13\" ry=\"9\"></ellipse>",
    "              <ellipse class=\"dom-presentation-avatar__hand dom-presentation-avatar__hand--right\" cx=\"112\" cy=\"121\" rx=\"13\" ry=\"9\"></ellipse>",
    "              <path class=\"dom-presentation-avatar__neck\" d=\"M58 80H80V101C80 107 75 111 69 111C63 111 58 107 58 101Z\"></path>",
    "              <path class=\"dom-presentation-avatar__head dom-presentation-avatar__head--beacon\" d=\"M38 43C38 25 51 14 69 14C87 14 100 25 100 43V60C100 79 87 91 69 91C51 91 38 79 38 60Z\"></path>",
    "              <path class=\"dom-presentation-avatar__hair dom-presentation-avatar__hair--beacon\" d=\"M38 43C40 24 52 12 70 12C88 12 99 23 101 40C84 35 67 31 49 35C46 39 43 42 38 43Z\"></path>",
    "              <circle class=\"dom-presentation-avatar__eye\" cx=\"58\" cy=\"52\" r=\"3\"></circle>",
    "              <circle class=\"dom-presentation-avatar__eye\" cx=\"80\" cy=\"52\" r=\"3\"></circle>",
    "              <path class=\"dom-presentation-avatar__glasses\" d=\"M49 50H66V60H49ZM72 50H89V60H72ZM66 55H72\"></path>",
    "              <path class=\"dom-presentation-avatar__mouth\" d=\"M61 68Q69 73 77 68\"></path>",
    "            </svg>"
  ].join("\n");
}

function renderMicaAvatarSvg(): string {
  return [
    "            <svg class=\"dom-presentation-avatar__svg\" viewBox=\"0 0 138 164\" role=\"img\" aria-label=\"\">",
    "              <ellipse class=\"dom-presentation-avatar__shadow\" cx=\"69\" cy=\"154\" rx=\"44\" ry=\"7\"></ellipse>",
    "              <circle class=\"dom-presentation-avatar__signal\" cx=\"112\" cy=\"20\" r=\"14\"></circle>",
    "              <circle class=\"dom-presentation-avatar__signal-dot\" cx=\"112\" cy=\"15\" r=\"2\"></circle>",
    "              <circle class=\"dom-presentation-avatar__signal-dot\" cx=\"112\" cy=\"24\" r=\"2\"></circle>",
    "              <path class=\"dom-presentation-avatar__body\" d=\"M25 156V116C25 96 42 84 69 84C96 84 113 96 113 116V156Z\"></path>",
    "              <path class=\"dom-presentation-avatar__shirt\" d=\"M55 89H83L69 126Z\"></path>",
    "              <ellipse class=\"dom-presentation-avatar__hand dom-presentation-avatar__hand--left\" cx=\"28\" cy=\"124\" rx=\"13\" ry=\"9\"></ellipse>",
    "              <ellipse class=\"dom-presentation-avatar__hand dom-presentation-avatar__hand--right\" cx=\"111\" cy=\"121\" rx=\"13\" ry=\"9\"></ellipse>",
    "              <path class=\"dom-presentation-avatar__neck\" d=\"M58 82H80V100C80 106 75 110 69 110C63 110 58 106 58 100Z\"></path>",
    "              <path class=\"dom-presentation-avatar__head\" d=\"M35 48C35 26 49 14 69 14C89 14 103 26 103 48C103 73 89 90 69 90C49 90 35 73 35 48Z\"></path>",
    "              <path class=\"dom-presentation-avatar__hair\" d=\"M34 45C37 22 51 10 70 10C88 10 100 20 104 38C88 40 73 34 60 26C53 36 45 42 34 45Z\"></path>",
    "              <circle class=\"dom-presentation-avatar__eye\" cx=\"57\" cy=\"51\" r=\"4\"></circle>",
    "              <circle class=\"dom-presentation-avatar__eye\" cx=\"81\" cy=\"51\" r=\"4\"></circle>",
    "              <path class=\"dom-presentation-avatar__mouth\" d=\"M61 66Q69 75 77 66\"></path>",
    "            </svg>"
  ].join("\n");
}

function renderNarrationAvatarSvg(avatar: NarrationAvatar): string {
  return avatar.art === "beacon" ? renderBeaconAvatarSvg() : renderMicaAvatarSvg();
}

function renderNarrationAvatarOverlay(): string {
  return [
    "      <aside class=\"dom-presentation-avatar\" data-narration-avatar data-avatar-selected=\"none\" data-avatar-state=\"idle\" aria-label=\"Narration avatar\" hidden>",
    "        <div class=\"dom-presentation-avatar__stage\" aria-hidden=\"true\">",
    ...bundledNarrationAvatars.map((avatar) => [
      `          <div class="dom-presentation-avatar__figure" data-avatar-id="${escapeHtml(avatar.id)}" style="--avatar-skin: ${escapeHtml(avatar.palette.skin)}; --avatar-hair: ${escapeHtml(avatar.palette.hair)}; --avatar-coat: ${escapeHtml(avatar.palette.coat)}; --avatar-accent: ${escapeHtml(avatar.palette.accent)};" hidden>`,
      renderNarrationAvatarSvg(avatar),
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
