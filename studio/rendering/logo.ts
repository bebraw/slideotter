export function renderSlideotterLogo(): string {
  return `
    <figure class="dom-slide__cover-logo" aria-label="slideotter logo">
      <svg viewBox="0 0 152 152" role="img" aria-hidden="true">
        <rect x="0" y="0" width="152" height="152" rx="30" fill="var(--dom-surface, #ffffff)" stroke="var(--dom-primary, #183153)" stroke-width="10"></rect>
        <path d="M28 104C33 66 55 43 88 38C118 34 139 51 146 78C151 98 144 118 126 132C108 146 81 150 57 141C38 134 27 120 28 104Z" fill="var(--dom-secondary, #275d8c)"></path>
        <path d="M38 91C45 69 63 57 88 57C111 57 128 70 132 92C136 113 119 130 92 134C63 138 31 119 38 91Z" fill="var(--dom-panel, #f8fbfe)"></path>
        <circle cx="68" cy="82" r="5.5" fill="var(--dom-primary, #183153)"></circle>
        <circle cx="109" cy="82" r="5.5" fill="var(--dom-primary, #183153)"></circle>
        <path d="M86 96C90 93 96 93 100 96C98 102 94 105 90 105C86 105 83 102 86 96Z" fill="var(--dom-primary, #183153)"></path>
        <path d="M52 31C51 17 61 8 73 13C84 18 84 34 73 42Z" fill="var(--dom-secondary, #275d8c)"></path>
        <path d="M111 42C100 34 100 18 111 13C123 8 133 17 132 31Z" fill="var(--dom-secondary, #275d8c)"></path>
        <path d="M27 48C14 49 5 59 10 71C15 82 31 82 39 71Z" fill="var(--dom-accent, #f28f3b)"></path>
        <path d="M121 131C140 124 151 111 154 94" fill="none" stroke="var(--dom-accent, #f28f3b)" stroke-width="12" stroke-linecap="round"></path>
        <path d="M75 111C83 117 96 117 104 111" fill="none" stroke="var(--dom-primary, #183153)" stroke-width="5" stroke-linecap="round"></path>
        <path d="M54 99H25M55 109H28M122 99H151M121 109H148" fill="none" stroke="var(--dom-primary, #183153)" stroke-width="4" stroke-linecap="round" opacity="0.72"></path>
      </svg>
    </figure>
  `;
}
