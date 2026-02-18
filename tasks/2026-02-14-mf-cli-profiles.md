# MF CLI Config Profiles

**Date:** 2026-02-14
**Description:** Add support for multiple CLI config files/profiles so users can switch between local/prod environments.

## TODO
- [x] Add named config profile storage
- [x] Add active profile selection (`mf config use <name>`)
- [x] Add global profile override (`--config <name>` / `-c <name>`)
- [x] Add profile listing (`mf config profiles`)
- [x] Preserve backward compatibility for legacy single-file config
- [x] Update CLI docs with local/prod examples
- [x] Verify profile switching behavior
