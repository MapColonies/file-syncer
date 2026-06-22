# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [2.2.4](https://github.com/MapColonies/file-syncer/compare/v2.2.3...v2.2.4) (2026-06-22)


### Helm Changes

* upgrade to the latest mc-labels (MAPCO-7126) ([#70](https://github.com/MapColonies/file-syncer/issues/70)) ([c1ed803](https://github.com/MapColonies/file-syncer/commit/c1ed803f8886c9a283cbd3647150aec0ab69bf68))

## [2.2.3](https://github.com/MapColonies/file-syncer/compare/v2.2.2...v2.2.3) (2026-06-09)


### Bug Fixes

* added support of 1038 to aws-sdk (MAPCO-10555) ([#68](https://github.com/MapColonies/file-syncer/issues/68)) ([aeb63a8](https://github.com/MapColonies/file-syncer/commit/aeb63a8b4f93d7345149912eda120014c76fe7b4))

## [2.2.2](https://github.com/MapColonies/file-syncer/compare/v2.2.1...v2.2.2) (2026-06-08)


### Bug Fixes

* added prefix and error detailes (MAPCO-10555) ([#66](https://github.com/MapColonies/file-syncer/issues/66)) ([db68687](https://github.com/MapColonies/file-syncer/commit/db686871f380f3a883d16cb99a09598eee99c7b5))

## [2.2.1](https://github.com/MapColonies/file-syncer/compare/v2.2.0...v2.2.1) (2026-05-28)


### Bug Fixes

* fix s3 deletion (MAPCO-10555) ([#64](https://github.com/MapColonies/file-syncer/issues/64)) ([2d4add6](https://github.com/MapColonies/file-syncer/commit/2d4add66dcbdf65956e15e514cc0d5a04deae2d2))

## [2.2.0](https://github.com/MapColonies/file-syncer/compare/v2.1.5...v2.2.0) (2026-05-05)


### Features

* make quiet true and added socket timeout  (MAPCO-10555) ([#62](https://github.com/MapColonies/file-syncer/issues/62)) ([27a6909](https://github.com/MapColonies/file-syncer/commit/27a69097f5872c0b33fc1cb63e3ab1ee61503868))

## [2.1.5](https://github.com/MapColonies/file-syncer/compare/v2.1.4...v2.1.5) (2026-01-06)


### Helm Changes

* update podAnnotations ([#60](https://github.com/MapColonies/file-syncer/issues/60)) ([eee67cd](https://github.com/MapColonies/file-syncer/commit/eee67cd75fb1d1adf50220a95e1d97ebc84f94e2))

## [2.1.4](https://github.com/MapColonies/file-syncer/compare/v2.1.3...v2.1.4) (2026-01-05)


### Helm Changes

* added podannotations and buckets to helm's values ([#58](https://github.com/MapColonies/file-syncer/issues/58)) ([641e629](https://github.com/MapColonies/file-syncer/commit/641e629f502c16b18f8eb6c0d8b9d5438229bd6f))

## [2.1.3](https://github.com/MapColonies/file-syncer/compare/v2.1.2...v2.1.3) (2026-01-01)


### Dependency Updates

* remove tag value from values ([#56](https://github.com/MapColonies/file-syncer/issues/56)) ([6c94b1e](https://github.com/MapColonies/file-syncer/commit/6c94b1ef48e9765daf28c2377168a56861e795dd))

## [2.1.2](https://github.com/MapColonies/file-syncer/compare/v2.1.1...v2.1.2) (2025-08-28)


### Helm Changes

* add support for mc annotations package ([#53](https://github.com/MapColonies/file-syncer/issues/53)) ([8201f3d](https://github.com/MapColonies/file-syncer/commit/8201f3d94c175dfcb6201f77bef65d8be60ed989))

### [2.1.1](https://github.com/MapColonies/file-syncer/compare/v2.1.0...v2.1.1) (2025-07-27)

## [2.1.0](https://github.com/MapColonies/file-syncer/compare/v2.0.4...v2.1.0) (2025-07-24)


### Features

* support delete job (MAPCO-8034) ([#50](https://github.com/MapColonies/file-syncer/issues/50)) ([162fb20](https://github.com/MapColonies/file-syncer/commit/162fb20c954c416d407366cf7fc781ceb991f0c5))

### [2.0.4](https://github.com/MapColonies/file-syncer/compare/v2.0.3...v2.0.4) (2024-12-17)


### Bug Fixes

* fix S3 client config parametr bug when using s3client and audit fix ([#49](https://github.com/MapColonies/file-syncer/issues/49)) ([8c825c4](https://github.com/MapColonies/file-syncer/commit/8c825c41471ff622b4d2db40967bfbbeb6f5f81b))

### [2.0.3](https://github.com/MapColonies/file-syncer/compare/v2.0.2...v2.0.3) (2024-12-16)


### Bug Fixes

* fix s3 provider ([#48](https://github.com/MapColonies/file-syncer/issues/48)) ([8fc38fe](https://github.com/MapColonies/file-syncer/commit/8fc38fe2c5775fefe7246d835e026459c78c8fcd))

### [2.0.2](https://github.com/MapColonies/file-syncer/compare/v2.0.1...v2.0.2) (2024-12-03)

### [2.0.1](https://github.com/MapColonies/file-syncer/compare/v2.0.0...v2.0.1) (2024-12-01)


### Bug Fixes

* fix helm ([#46](https://github.com/MapColonies/file-syncer/issues/46)) ([13f5284](https://github.com/MapColonies/file-syncer/commit/13f528496c6e7453e420214ca3c74bfd20b660e0))

## [2.0.0](https://github.com/MapColonies/file-syncer/compare/v1.4.3...v2.0.0) (2024-11-28)


### ⚠ BREAKING CHANGES

* support new s3 client and config (#45)

### Features

* support new s3 client and config ([#45](https://github.com/MapColonies/file-syncer/issues/45)) ([7a475b2](https://github.com/MapColonies/file-syncer/commit/7a475b2673918fa5d2f5c80967947fd16ce88c13))

### [1.4.3](https://github.com/MapColonies/file-syncer/compare/v1.4.2...v1.4.3) (2024-09-09)

### [1.4.2](https://github.com/MapColonies/file-syncer/compare/v1.4.1...v1.4.2) (2024-09-04)

### [1.4.1](https://github.com/MapColonies/file-syncer/compare/v1.4.0...v1.4.1) (2024-08-26)


### Bug Fixes

* error exception ([#42](https://github.com/MapColonies/file-syncer/issues/42)) ([d34cd64](https://github.com/MapColonies/file-syncer/commit/d34cd649d643fbef2a8ca33114a68e462a5a2ff9))
