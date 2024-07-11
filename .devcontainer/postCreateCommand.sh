#!/usr/bin/fish

rm -fr .git/hooks
ln -s ../hooks .git/hooks
cp .devcontainer/config.fish ~/.config/fish/config.fish
deno cache index.ts tests/index.test.ts
