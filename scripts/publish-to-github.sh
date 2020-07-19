#!/bin/bash
echo "@dimensiondev:registry=https://npm.pkg.github.com/DimensionDev" > "$HOME/.npmrc"

jq '.name = "@dimensiondev/holoflows-kit"' package.json > package-modified.json
mv package-modified.json package.json

VERSION=$(jq -r '.version' package.json)
npm --no-git-tag-version version "$VERSION-$GITHUB_RUN_NUMBER"
npm publish
