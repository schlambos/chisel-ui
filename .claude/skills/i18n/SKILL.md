---
name: i18n
description: |
  DO NOT USE. This fork is English-only. The upstream i18n workflow is suspended.
  If you were about to invoke this skill to add/translate strings, stop and use
  plain English copy directly. See AGENTS.md § "Internationalization (i18n) — DO NOT IMPLEMENT".
---

# i18n Skill — SUSPENDED

**This skill is intentionally a no-op for this fork.**

Do not spend time on i18n, localization, translation dictionaries, locale routing, language switchers, or abstraction layers for display strings unless the owner explicitly requests it.

For now, the app is English-only. Use plain English UI copy directly where appropriate. Do not create locale files, i18n providers, translation hooks, or string-key systems.

The only acceptable consideration is avoiding obviously hostile future design choices, such as deeply coupling business logic to user-facing prose. But do not proactively implement i18n infrastructure.

Prioritize functional correctness, UX behavior, state management, architecture, bug fixing, and code maintainability over theoretical future localization.

## If You Were About to Add a New User-Facing String

Write it as a literal English string in JSX / source. Do **not**:

- Add a key to `src/renderer/i18n/locales/**`
- Run `bun run i18n:types`
- Run `node scripts/check-i18n.js`
- Add entries to `src/common/config/i18n-config.json`
- Import `useTranslation` or `Trans` for new code

## If You Encounter Existing `t('...')` Calls

Leave them alone. Do not refactor them away unless explicitly asked. The directive is "do not proactively add i18n infrastructure" — it is not "rip out what is already there."

## Reference

The original upstream version of this skill lives in upstream git history (iOfficeAI/AionUi) if ever needed. Do not follow it for this fork.
