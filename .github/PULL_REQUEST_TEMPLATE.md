# What and why

<!-- What changed, and what problem it solves. Link the issue if there is one. -->

## Checklist

- [ ] `npm test` passes
- [ ] `npm run lint` and `npm run format:check` pass
- [ ] `npm run build` completes, and `npm run check:exports && npm run check:size` pass afterwards
- [ ] New behavior has test coverage
- [ ] Public API changes are reflected in the JSDoc (which generates `dist/index.d.ts`) and the README
- [ ] `CHANGELOG.md` has an entry under `Unreleased`

## Boundary check

This package is UI and state only.

- [ ] This change adds no network call, and no API key, endpoint, or base URL to the config
- [ ] Any new config field is JSON-serializable and has a `data-*` equivalent in `CONFIG_SCHEMA`
- [ ] Any new option that is _not_ serializable (a function, a DOM node) is JS-only by design

## Breaking changes

<!-- Config fields, callbacks, payload shapes, and the instance API are the public surface.
     None of them may change within a major version. Describe the migration if this breaks one. -->
