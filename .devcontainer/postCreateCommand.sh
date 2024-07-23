#!/usr/bin/fish

rm -fr .git/hooks
ln -s ../hooks .git/hooks
cp .devcontainer/config.fish ~/.config/fish/config.fish
deno cache index.ts tests/index.test.ts
git config --global --add safe.directory /workspace

sudo apt-get update
sudo apt-get install -y dnsutils
sudo cp .devcontainer/certs/dev.zoneblitz.app.cert /usr/local/share/ca-certificates/dev.zoneblitz.app.crt
sudo update-ca-certificates

.devcontainer/addProxyHost.sh
